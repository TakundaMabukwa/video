import { IncomingMessage } from 'http'
import net from 'net'
import WebSocket, { WebSocketServer } from 'ws'
import { RawVideoMessageLogger } from '../logging/rawVideoMessageLogger'
import type { AlertEvent } from '../alerts/alertManager'

const RAW_STREAM_PROTOCOL_TRACE =
  process.env.RAW_STREAM_PROTOCOL_TRACE === undefined
    ? true
    : parseInt(process.env.RAW_STREAM_PROTOCOL_TRACE, 10) === 1 ||
      process.env.RAW_STREAM_PROTOCOL_TRACE?.toLowerCase() === 'true' ||
      process.env.RAW_STREAM_PROTOCOL_TRACE?.toLowerCase() === 'yes'

const RAW_STREAM_TCP_ENABLED =
  process.env.RAW_STREAM_TCP_ENABLED === undefined
    ? true
    : parseInt(process.env.RAW_STREAM_TCP_ENABLED, 10) === 1 ||
      process.env.RAW_STREAM_TCP_ENABLED?.toLowerCase() === 'true' ||
      process.env.RAW_STREAM_TCP_ENABLED?.toLowerCase() === 'yes'

const RAW_STREAM_HOST = process.env.RAW_STREAM_HOST || '0.0.0.0'
const RAW_STREAM_PORT = parseInt(process.env.RAW_STREAM_PORT || '7081', 10)

export interface ProtocolMessageMetadata {
  type: 'jt808-message'
  vehicleId: string
  messageId: number
  messageIdHex: string
  serialNumber: number
  bodyLength: number
  rawFrameHex: string
  bodyHex: string
  bodyTextPreview: string
  parse?: Record<string, unknown>
  direction?: 'inbound' | 'outbound'
  timestamp: number
}

type RawAlertPayload = {
  vehicleId: string
  channel: number
  priority: string
  alertType: string
  signalCodes: string[]
  sourceMessageId: string | null
  timestamp: string
  metadata: Record<string, unknown>
}

export class RawStreamServer {
  private wss = new WebSocketServer({
    noServer: true,
    perMessageDeflate: false,
  })

  private clients = new Set<WebSocket>()

  private tcpClients = new Set<net.Socket>()

  private tcpServer: net.Server | null = null

  private path: string

  private encoding: 'base64' | 'hex' =
    String(process.env.RAW_VIDEO_WS_ENCODING || 'base64')
      .trim()
      .toLowerCase() === 'hex'
      ? 'hex'
      : 'base64'

  constructor(path = '/ws/raw') {
    this.path = path

    this.wss.on('connection', (ws) => {
      this.clients.add(ws)

      this.safeSend(ws, {
        type: 'hello',
        ts: Date.now(),
        stream: 'raw-video',
        encoding: this.encoding,
      })

      ws.on('close', () => {
        this.clients.delete(ws)
      })

      ws.on('error', () => {
        this.clients.delete(ws)
      })
    })

    if (RAW_STREAM_TCP_ENABLED) {
      this.tcpServer = net.createServer((socket) => {
        socket.setNoDelay(true)
        this.tcpClients.add(socket)

        socket.on('close', () => {
          this.tcpClients.delete(socket)
        })

        socket.on('end', () => {
          this.tcpClients.delete(socket)
        })

        socket.on('error', (error) => {
          this.tcpClients.delete(socket)
          console.error('Raw stream TCP client error:', error)
        })
      })

      this.tcpServer.on('error', (error) => {
        console.error('Raw stream TCP server error:', error)
      })

      this.tcpServer.listen(RAW_STREAM_PORT, RAW_STREAM_HOST, () => {
        console.log(
          `Raw stream TCP feed listening on ${RAW_STREAM_HOST}:${RAW_STREAM_PORT}`,
        )
      })
    }
  }

  public getPath() {
    return this.path
  }

  public handleUpgrade(req: IncomingMessage, socket: any, head: Buffer) {
    this.wss.handleUpgrade(req, socket, head, (ws) => {
      this.wss.emit('connection', ws, req)
    })
  }

  public handlePacket(vehicleId: string, packet: Buffer, channel?: number) {
    const timestamp = Date.now()

    this.broadcast({
      type: 'VIDEO_PACKET_RAW',
      vehicleId,
      channel: channel ?? null,
      timestamp: new Date(timestamp).toISOString(),
      size: packet.length,
      encoding: this.encoding,
      payload: this.encode(packet),
    })

    this.broadcastTcpPacket(
      {
        type: 'tcp-rtp',
        vehicleId,
        channel: channel ?? null,
        size: packet.length,
        timestamp,
      },
      packet,
    )
  }

  public handleCameraChunk(payload: {
    sourceIp: string
    vehicleId: string | null
    sourcePort: number | null
    chunkBase64: string
    chunkSize: number
    receivedAt: string
    transport: 'tcp'
  }) {
    this.broadcast({
      type: 'CAMERA_TCP_CHUNK_RAW',
      sourceIp: payload.sourceIp,
      vehicleId: payload.vehicleId,
      sourcePort: payload.sourcePort,
      timestamp: payload.receivedAt,
      size: payload.chunkSize,
      encoding: 'base64',
      transport: payload.transport,
      chunk: payload.chunkBase64,
    })
  }

  public handleFrame(
    transport: 'udp' | 'tcp',
    vehicleId: string,
    channel: number,
    frame: Buffer,
    isIFrame: boolean,
  ) {
    this.broadcast({
      type: 'VIDEO_FRAME_RAW',
      transport,
      vehicleId,
      channel,
      timestamp: new Date().toISOString(),
      isIFrame,
      size: frame.length,
      encoding: this.encoding,
      assembledPayload: this.encode(frame),
    })
  }

  public handleProtocolMessage(metadata: ProtocolMessageMetadata) {
    if (!RAW_STREAM_PROTOCOL_TRACE) return

    this.broadcast({
      ...metadata,
      type: 'JT808_PROTOCOL_MESSAGE',
    })
  }

  public handleAlert(alert: AlertEvent) {
    const metadata =
      alert.metadata && typeof alert.metadata === 'object' ? alert.metadata : {}
    const signalCodes = Array.isArray((metadata as any).alertSignals)
      ? (metadata as any).alertSignals
          .map((value: unknown) => String(value || '').trim())
          .filter(Boolean)
      : []

    const payload: RawAlertPayload = {
      vehicleId: String(alert.vehicleId || ''),
      channel: Number(alert.channel || 1),
      priority: String(alert.priority || ''),
      alertType: String(alert.type || ''),
      signalCodes,
      sourceMessageId: String((metadata as any).sourceMessageId || '') || null,
      timestamp:
        alert.timestamp instanceof Date
          ? alert.timestamp.toISOString()
          : new Date().toISOString(),
      metadata: metadata as Record<string, unknown>,
    }

    this.broadcast({
      type: 'ALERT_RAW',
      ...payload,
    })
  }

  private encode(buffer: Buffer): string {
    return this.encoding === 'hex'
      ? buffer.toString('hex')
      : buffer.toString('base64')
  }

  private broadcast(payload: Record<string, unknown>) {
    RawVideoMessageLogger.write(payload)

    const message = JSON.stringify(payload)

    for (const ws of Array.from(this.clients)) {
      if (ws.readyState !== WebSocket.OPEN) {
        this.clients.delete(ws)
        continue
      }

      try {
        ws.send(message)
      } catch (error) {
        this.clients.delete(ws)
        console.error('Raw stream WebSocket send failed:', error)
      }
    }
  }

  private safeSend(ws: WebSocket, payload: Record<string, unknown>) {
    if (ws.readyState !== WebSocket.OPEN) return

    try {
      ws.send(JSON.stringify(payload))
    } catch (error) {
      this.clients.delete(ws)
      console.error('Raw stream WebSocket hello failed:', error)
    }
  }

  private broadcastTcpPacket(
    metadata: Record<string, unknown>,
    payload: Buffer,
  ) {
    if (this.tcpClients.size === 0) return

    const metadataBuffer = Buffer.from(JSON.stringify(metadata), 'utf8')
    const header = Buffer.allocUnsafe(8)
    header.writeUInt32BE(metadataBuffer.length, 0)
    header.writeUInt32BE(payload.length, 4)
    const packet = Buffer.concat([header, metadataBuffer, payload])

    for (const client of Array.from(this.tcpClients)) {
      if (client.destroyed || !client.writable) {
        this.tcpClients.delete(client)
        continue
      }

      client.write(packet, (error) => {
        if (!error) return
        this.tcpClients.delete(client)
        console.error('Raw stream TCP send failed:', error)
        try {
          client.destroy()
        } catch {
          // ignore socket cleanup failures
        }
      })
    }
  }
}
