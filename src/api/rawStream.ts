import { IncomingMessage } from 'http';
import WebSocket, { WebSocketServer } from 'ws';

export class RawStreamServer {
  private wss = new WebSocketServer({ noServer: true, perMessageDeflate: false });
  private clients = new Set<WebSocket>();

  constructor(private path = '/ws/raw') {
    this.wss.on('connection', (ws) => {
      this.clients.add(ws);
      ws.on('close', () => this.clients.delete(ws));
      ws.on('error', () => this.clients.delete(ws));
    });
  }

  getPath() { return this.path; }

  handleUpgrade(req: IncomingMessage, socket: any, head: Buffer) {
    this.wss.handleUpgrade(req, socket, head, (ws) => this.wss.emit('connection', ws, req));
  }

  push(data: Buffer) {
    for (const ws of this.clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data, { binary: true, compress: false, fin: true, mask: false });
      }
    }
  }
}
