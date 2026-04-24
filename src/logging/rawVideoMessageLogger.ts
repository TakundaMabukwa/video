import * as fs from 'fs'
import * as path from 'path'

export class RawVideoMessageLogger {
  private static readonly dirPath = path.join(process.cwd(), 'logs')
  private static readonly filePath = path.join(
    RawVideoMessageLogger.dirPath,
    'raw-video.ndjson',
  )
  private static readonly enabled = RawVideoMessageLogger.resolveEnabled()

  private static resolveEnabled(): boolean {
    const explicit = process.env.RAW_VIDEO_FILE_LOGGING_ENABLED
    if (typeof explicit === 'string' && explicit.trim()) {
      return ['1', 'true', 'yes', 'on'].includes(explicit.trim().toLowerCase())
    }

    return ['1', 'true', 'yes', 'on'].includes(
      String(process.env.RAW_VIDEO_WS_ENABLED ?? 'true').trim().toLowerCase(),
    )
  }

  private static ensureReady(): void {
    if (!fs.existsSync(this.dirPath)) {
      fs.mkdirSync(this.dirPath, { recursive: true })
    }
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, '', 'utf8')
    }
  }

  static write(payload: Record<string, unknown>): void {
    if (!this.enabled) return

    try {
      this.ensureReady()
      fs.appendFileSync(
        this.filePath,
        `${JSON.stringify({ ts: new Date().toISOString(), ...payload })}\n`,
        'utf8',
      )
    } catch {
      // Never throw from ingest path.
    }
  }
}
