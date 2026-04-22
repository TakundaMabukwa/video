import net from 'net'

const RAW_STREAM_PORT = parseInt(process.env.RAW_STREAM_PORT || '7081', 10)
const RAW_STREAM_HOST = process.env.RAW_STREAM_HOST || '0.0.0.0'

export class RawStreamServer {
  private server: net.Server
  private clients = new Set<net.Socket>()

  constructor() {
    this.server = net.createServer((socket) => this.onConnection(socket))
    this.server.on('error', (error) => {
      console.error('RawStreamServer error:', error)
    })
    this.server.listen(RAW_STREAM_PORT, RAW_STREAM_HOST, () => {
      console.log(
        `Raw stream TCP tap listening on ${RAW_STREAM_HOST}:${RAW_STREAM_PORT}`,
      )
    })
  }

  private onConnection(socket: net.Socket) {
    const clientId = `${socket.remoteAddress}:${socket.remotePort}`
    console.log('Raw stream client connected:', clientId)
    this.clients.add(socket)

    socket.on('close', () => {
      this.clients.delete(socket)
      console.log('Raw stream client disconnected:', clientId)
    })

    socket.on('error', (error) => {
      this.clients.delete(socket)
      console.error('Raw stream client error:', clientId, error)
    })
  }

  public handlePacket(vehicleId: string, packet: Buffer, channel?: number) {
    if (this.clients.size === 0) return

    const metadata = {
      type: 'tcp-rtp',
      vehicleId,
      channel: typeof channel === 'number' ? channel : null,
      size: packet.length,
      timestamp: Date.now(),
    }
    const metadataBuffer = Buffer.from(JSON.stringify(metadata), 'utf8')
    const header = Buffer.allocUnsafe(8)
    header.writeUInt32BE(metadataBuffer.length, 0)
    header.writeUInt32BE(packet.length, 4)
    const payload = Buffer.concat([header, metadataBuffer, packet])

    for (const client of Array.from(this.clients)) {
      if (client.destroyed) {
        this.clients.delete(client)
        continue
      }

      client.write(payload, (error) => {
        if (error) {
          this.clients.delete(client)
          console.error('Raw stream write failed:', error)
          client.destroy()
        }
      })
    }
  }
}
