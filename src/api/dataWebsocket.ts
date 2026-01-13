import { WebSocketServer, WebSocket } from 'ws';

export class DataWebSocketServer {
  private wss: WebSocketServer;

  constructor(port: number) {
    this.wss = new WebSocketServer({ port });

    this.wss.on('connection', (ws: WebSocket) => {
      console.log('📡 Data WS client connected');

      ws.on('close', () => {
        console.log('❌ Data WS client disconnected');
      });
    });

    console.log(`📡 Data WebSocket listening on ws://localhost:${port}`);
  }

  broadcast(data: any) {
    const payload = JSON.stringify(data);

    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }
}
