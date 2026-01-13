import { Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';

export class WebRTCSignalingServer {
  private wss: WebSocketServer;
  private clients = new Map<WebSocket, string>();

  constructor(httpServer: HTTPServer) {
    this.wss = new WebSocketServer({ 
      server: httpServer, 
      path: '/webrtc',
      perMessageDeflate: false
    });

    this.wss.on('connection', (ws: WebSocket) => {
      const clientId = Math.random().toString(36).substr(2, 9);
      this.clients.set(ws, clientId);
      console.log(`[WebRTC] Client connected: ${clientId}`);

      ws.on('message', (data: Buffer) => {
        const msg = JSON.parse(data.toString());
        
        // Broadcast signaling messages to other clients
        this.wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ ...msg, from: clientId }));
          }
        });
      });

      ws.on('close', () => {
        console.log(`[WebRTC] Client disconnected: ${clientId}`);
        this.clients.delete(ws);
      });
    });

    console.log('[WebRTC] Signaling server initialized');
  }

  broadcastVideoData(buffer: Buffer, vehicleId: string) {
    const msg = JSON.stringify({
      type: 'video-data',
      vehicleId,
      data: buffer.toString('base64'),
      timestamp: Date.now()
    });
    
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    });
  }
}
