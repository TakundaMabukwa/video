import { exec } from 'child_process'

type ArchiveFramePayload = {
  vehicleId: string
  channel: number
  transport: 'tcp' | 'udp'
  timestamp: string
  isIFrame: boolean
  encoding: 'base64'
  assembledPayload: string
}

type ArchiveChunkPayload = {
  vehicleId: string | null
  sourceIp: string
  sourcePort: number | null
  transport: 'tcp'
  timestamp: string
  encoding: 'base64'
  chunk: string
}

type RawVideoArchiveForwarderOptions = {
  archiveServerUrl?: string
  authToken?: string
  forwardTimeoutMs?: number
  failureThreshold?: number
  recoveryCooldownMs?: number
  recoveryCommand?: string
}

type FailureState = {
  count: number
  lastError?: string
  lastFailureAt?: number
  lastRecoveryAt?: number
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export class RawVideoArchiveForwarder {
  private readonly archiveServerUrl?: string
  private readonly authToken?: string
  private readonly forwardTimeoutMs: number
  private readonly forwardRetryCount: number
  private readonly failureThreshold: number
  private readonly recoveryCooldownMs: number
  private readonly recoveryCommand?: string
  private readonly frameBatchSize: number
  private readonly frameFlushMs: number
  private readonly frameMaxQueue: number
  private readonly chunkBatchSize: number
  private readonly chunkFlushMs: number
  private readonly chunkMaxQueue: number
  private readonly frameQueue: ArchiveFramePayload[] = []
  private readonly chunkQueue: ArchiveChunkPayload[] = []
  private readonly failureState: FailureState = { count: 0 }
  private frameFlushTimer: NodeJS.Timeout | null = null
  private chunkFlushTimer: NodeJS.Timeout | null = null
  private frameFlushInFlight = false
  private chunkFlushInFlight = false
  private frameDropWarnedAt = 0
  private chunkDropWarnedAt = 0

  constructor(options: RawVideoArchiveForwarderOptions) {
    this.archiveServerUrl = this.normalizeBaseUrl(options.archiveServerUrl)
    this.authToken = options.authToken?.trim() || undefined
    this.forwardTimeoutMs = Math.max(
      1000,
      Number(options.forwardTimeoutMs || process.env.RAW_VIDEO_ARCHIVE_TIMEOUT_MS || 15000),
    )
    this.forwardRetryCount = Math.max(
      1,
      Number(process.env.RAW_VIDEO_ARCHIVE_RETRY_COUNT || 3),
    )
    this.failureThreshold = Math.max(
      1,
      Number(options.failureThreshold || process.env.RAW_VIDEO_ARCHIVE_FAILURE_THRESHOLD || 5),
    )
    this.recoveryCooldownMs = Math.max(
      10000,
      Number(
        options.recoveryCooldownMs ||
          process.env.RAW_VIDEO_ARCHIVE_RECOVERY_COOLDOWN_MS ||
          300000,
      ),
    )
    this.recoveryCommand = options.recoveryCommand?.trim() || undefined
    this.frameBatchSize = Math.max(
      1,
      Number(process.env.RAW_VIDEO_ARCHIVE_FRAME_BATCH_SIZE || 24),
    )
    this.frameFlushMs = Math.max(
      10,
      Number(process.env.RAW_VIDEO_ARCHIVE_FRAME_FLUSH_MS || 200),
    )
    this.frameMaxQueue = Math.max(
      this.frameBatchSize,
      Number(process.env.RAW_VIDEO_ARCHIVE_FRAME_MAX_QUEUE || 5000),
    )
    this.chunkBatchSize = Math.max(
      1,
      Number(process.env.RAW_VIDEO_ARCHIVE_CHUNK_BATCH_SIZE || 64),
    )
    this.chunkFlushMs = Math.max(
      10,
      Number(process.env.RAW_VIDEO_ARCHIVE_CHUNK_FLUSH_MS || 200),
    )
    this.chunkMaxQueue = Math.max(
      this.chunkBatchSize,
      Number(process.env.RAW_VIDEO_ARCHIVE_CHUNK_MAX_QUEUE || 20000),
    )
  }

  isEnabled(): boolean {
    return !!this.archiveServerUrl
  }

  queueFrame(
    transport: 'tcp' | 'udp',
    vehicleId: string,
    channel: number,
    frame: Buffer,
    isIFrame: boolean,
  ): void {
    if (!this.archiveServerUrl) return
    if (this.frameQueue.length >= this.frameMaxQueue) {
      const now = Date.now()
      if (now - this.frameDropWarnedAt > 10000) {
        this.frameDropWarnedAt = now
        console.warn(
          `[RawVideoArchiveForwarder] Frame queue is full (${this.frameQueue.length}/${this.frameMaxQueue}). Dropping newest assembled frame until archive worker catches up.`,
        )
      }
      return
    }

    this.frameQueue.push({
      vehicleId,
      channel,
      transport,
      timestamp: new Date().toISOString(),
      isIFrame,
      encoding: 'base64',
      assembledPayload: frame.toString('base64'),
    })
    this.scheduleFrameFlush()
  }

  queueRawChunk(payload: {
    sourceIp: string
    vehicleId: string | null
    sourcePort: number | null
    chunkBase64: string
    receivedAt: string
    transport: 'tcp'
  }): void {
    if (!this.archiveServerUrl) return
    if (this.chunkQueue.length >= this.chunkMaxQueue) {
      const now = Date.now()
      if (now - this.chunkDropWarnedAt > 10000) {
        this.chunkDropWarnedAt = now
        console.warn(
          `[RawVideoArchiveForwarder] Raw chunk queue is full (${this.chunkQueue.length}/${this.chunkMaxQueue}). Dropping newest camera chunk until archive worker catches up.`,
        )
      }
      return
    }

    this.chunkQueue.push({
      vehicleId: payload.vehicleId,
      sourceIp: payload.sourceIp,
      sourcePort: payload.sourcePort,
      transport: payload.transport,
      timestamp: payload.receivedAt,
      encoding: 'base64',
      chunk: payload.chunkBase64,
    })
    this.scheduleChunkFlush()
  }

  private normalizeBaseUrl(url?: string): string | undefined {
    const normalized = String(url || '').trim().replace(/\/+$/, '')
    return normalized || undefined
  }

  private scheduleFrameFlush(): void {
    if (this.frameFlushInFlight || this.frameFlushTimer) return
    this.frameFlushTimer = setTimeout(() => {
      this.frameFlushTimer = null
      void this.flushFrameQueue()
    }, this.frameFlushMs)
  }

  private scheduleChunkFlush(): void {
    if (this.chunkFlushInFlight || this.chunkFlushTimer) return
    this.chunkFlushTimer = setTimeout(() => {
      this.chunkFlushTimer = null
      void this.flushChunkQueue()
    }, this.chunkFlushMs)
  }

  private async flushFrameQueue(): Promise<void> {
    if (!this.archiveServerUrl || this.frameFlushInFlight || this.frameQueue.length === 0) {
      return
    }

    this.frameFlushInFlight = true
    try {
      while (this.frameQueue.length > 0) {
        const batch = this.frameQueue.splice(0, this.frameBatchSize)
        await this.postJson(
          `${this.archiveServerUrl}/api/internal/ingest/raw-video/frame-batch`,
          { frames: batch },
        )
      }
    } catch (error: any) {
      console.error(
        `[RawVideoArchiveForwarder] Failed to flush assembled frame batch: ${error?.message || error}`,
      )
    } finally {
      this.frameFlushInFlight = false
      if (this.frameQueue.length > 0) {
        this.scheduleFrameFlush()
      }
    }
  }

  private async flushChunkQueue(): Promise<void> {
    if (!this.archiveServerUrl || this.chunkFlushInFlight || this.chunkQueue.length === 0) {
      return
    }

    this.chunkFlushInFlight = true
    try {
      while (this.chunkQueue.length > 0) {
        const batch = this.chunkQueue.splice(0, this.chunkBatchSize)
        await this.postJson(
          `${this.archiveServerUrl}/api/internal/ingest/raw-video/chunk-batch`,
          { chunks: batch },
        )
      }
    } catch (error: any) {
      console.error(
        `[RawVideoArchiveForwarder] Failed to flush raw camera chunk batch: ${error?.message || error}`,
      )
    } finally {
      this.chunkFlushInFlight = false
      if (this.chunkQueue.length > 0) {
        this.scheduleChunkFlush()
      }
    }
  }

  private isRetryableForwardError(error: any): boolean {
    const message = String(error?.message || '').toLowerCase()
    const causeCode = String(error?.cause?.code || '').toUpperCase()
    return (
      message.includes('fetch failed') ||
      message.includes('aborted') ||
      causeCode === 'ECONNRESET' ||
      causeCode === 'ETIMEDOUT' ||
      causeCode === 'UND_ERR_SOCKET' ||
      causeCode === 'UND_ERR_CONNECT_TIMEOUT'
    )
  }

  private async postJson(url: string, body: any): Promise<void> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Connection: 'close',
    }
    if (this.authToken) {
      headers['X-Internal-Token'] = this.authToken
    }

    let lastError: any = null
    for (let attempt = 1; attempt <= this.forwardRetryCount; attempt += 1) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), this.forwardTimeoutMs)

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        })

        if (!response.ok) {
          const text = await response.text().catch(() => '')
          throw new Error(`Forward failed ${response.status}: ${text || response.statusText}`)
        }

        this.resetFailureState()
        return
      } catch (error: any) {
        lastError = error
        const canRetry =
          attempt < this.forwardRetryCount && this.isRetryableForwardError(error)
        if (!canRetry) {
          this.recordFailure(url, error)
          throw error
        }
        console.warn(
          `[RawVideoArchiveForwarder] Request failed on attempt ${attempt}/${this.forwardRetryCount} for ${url}: ${error?.message || error}`,
        )
        await sleep(250 * attempt)
      } finally {
        clearTimeout(timeout)
      }
    }

    this.recordFailure(url, lastError)
    throw lastError
  }

  private resetFailureState(): void {
    this.failureState.count = 0
    this.failureState.lastError = undefined
    this.failureState.lastFailureAt = undefined
  }

  private recordFailure(url: string, error: any): void {
    const now = Date.now()
    this.failureState.count += 1
    this.failureState.lastFailureAt = now
    this.failureState.lastError = error?.message || String(error)

    if (this.failureState.count < this.failureThreshold) return
    if (!this.recoveryCommand) {
      console.warn(
        `[RawVideoArchiveForwarder] Archive worker failed ${this.failureState.count} times for ${url} but no recovery command is configured.`,
      )
      return
    }
    if (
      this.failureState.lastRecoveryAt &&
      now - this.failureState.lastRecoveryAt < this.recoveryCooldownMs
    ) {
      return
    }

    this.failureState.lastRecoveryAt = now
    console.warn(
      `[RawVideoArchiveForwarder] Archive worker failed ${this.failureState.count} times. Running recovery command: ${this.recoveryCommand}`,
    )

    exec(this.recoveryCommand, { timeout: 60000 }, (execError, stdout, stderr) => {
      if (execError) {
        console.error(
          `[RawVideoArchiveForwarder] Recovery command failed: ${execError.message}`,
        )
        return
      }
      if (stdout?.trim()) {
        console.log(`[RawVideoArchiveForwarder] Recovery stdout: ${stdout.trim()}`)
      }
      if (stderr?.trim()) {
        console.warn(`[RawVideoArchiveForwarder] Recovery stderr: ${stderr.trim()}`)
      }
    })
  }
}
