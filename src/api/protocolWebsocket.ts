import { IncomingMessage } from 'http';
import WebSocket, { WebSocketServer } from 'ws';

export type ProtocolTracePayload = {
  id?: number;
  receivedAt?: string;
  direction?: 'inbound' | 'outbound';
  vehicleId?: string;
  messageId?: number;
  messageIdHex?: string;
  serialNumber?: number;
  bodyLength?: number;
  rawFrameHex?: string;
  bodyHex?: string;
  bodyTextPreview?: string;
  parse?: Record<string, unknown>;
};

export class ProtocolWebSocketServer {
  private readonly pathToServer = new Map<string, WebSocketServer>();
  private readonly pathToClients = new Map<string, Set<WebSocket>>();
  private readonly paths: string[];

  constructor(messageIds: string[], basePath = '/ws/protocol') {
    const normalizedIds = Array.from(
      new Set(
        messageIds
          .map((id) => String(id || '').trim().toLowerCase())
          .filter((id) => /^0x[0-9a-f]{4}$/i.test(id))
      )
    );

    this.paths = [`${basePath}/all`, ...normalizedIds.map((id) => `${basePath}/${id}`)];

    for (const path of this.paths) {
      const wss = new WebSocketServer({ noServer: true });
      const clients = new Set<WebSocket>();
      this.pathToServer.set(path, wss);
      this.pathToClients.set(path, clients);

      wss.on('connection', (ws, req) => {
        clients.add(ws);
        this.safeSend(ws, {
          type: 'connected',
          path,
          timestamp: new Date().toISOString()
        });

        ws.on('close', () => clients.delete(ws));
        ws.on('error', () => clients.delete(ws));
      });
    }
  }

  getPaths(): string[] {
    return [...this.paths];
  }

  handleUpgrade(request: IncomingMessage, socket: any, head: Buffer, pathname: string): boolean {
    const wss = this.pathToServer.get(pathname);
    if (!wss) return false;
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
    return true;
  }

  broadcastTrace(trace: ProtocolTracePayload): void {
    const messageIdHex = String(trace?.messageIdHex || '').trim().toLowerCase();
    const payload = JSON.stringify({
      type: 'PROTOCOL_TRACE',
      trace
    });

    this.broadcastToPath('/ws/protocol/all', payload);
    if (messageIdHex && this.pathToClients.has(`/ws/protocol/${messageIdHex}`)) {
      this.broadcastToPath(`/ws/protocol/${messageIdHex}`, payload);
    }
  }

  private broadcastToPath(path: string, payload: string): void {
    const clients = this.pathToClients.get(path);
    if (!clients) return;
    for (const ws of clients) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      try {
        ws.send(payload);
      } catch {
        clients.delete(ws);
      }
    }
  }

  private safeSend(ws: WebSocket, payload: unknown): void {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
      }
    } catch {
      // ignore
    }
  }
}
