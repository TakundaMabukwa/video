import { IncomingMessage } from 'http'
import WebSocket, { WebSocketServer } from 'ws'
import { RawVideoMessageLogger } from '../logging/rawVideoMessageLogger'

const RAW_STREAM_PROTOCOL_TRACE =
  process.env.RAW_STREAM_PROTOCOL_TRACE === undefined
    ? true
    : parseInt(process.env.RAW_STREAM_PROTOCOL_TRACE, 10) === 1 ||
      process.env.RAW_STREAM_PROTOCOL_TRACE?.toLowerCase() === 'true' ||
      process.env.RAW_STREAM_PROTOCOL_TRACE?.toLowerCase() === 'yes'

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

export class RawStreamServer {
  private wss = new WebSocketServer({
    noServer: true,
    perMessageDeflate: false,
  })

  private clients = new Set<WebSocket>()

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
    this.broadcast({
      type: 'VIDEO_PACKET_RAW',
      vehicleId,
      channel: channel ?? null,
      timestamp: new Date().toISOString(),
      size: packet.length,
      encoding: this.encoding,
      payload: this.encode(packet),
    })
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
}
