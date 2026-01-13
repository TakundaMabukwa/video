import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

export class WebRTCSignalingServer {
  private io: SocketIOServer;
  private peers = new Map<string, any>();

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: { origin: '*' },
      path: '/webrtc'
    });

    this.io.on('connection', (socket) => {
      console.log(`[WebRTC] Client connected: ${socket.id}`);

      socket.on('offer', (data) => {
        socket.broadcast.emit('offer', { ...data, from: socket.id });
      });

      socket.on('answer', (data) => {
        this.io.to(data.to).emit('answer', { ...data, from: socket.id });
      });

      socket.on('ice-candidate', (data) => {
        socket.broadcast.emit('ice-candidate', { ...data, from: socket.id });
      });

      socket.on('disconnect', () => {
        console.log(`[WebRTC] Client disconnected: ${socket.id}`);
        this.peers.delete(socket.id);
      });
    });

    console.log('[WebRTC] Signaling server initialized');
  }

  broadcastVideoData(buffer: Buffer, vehicleId: string) {
    this.io.emit('video-data', {
      vehicleId,
      data: buffer.toString('base64'),
      timestamp: Date.now()
    });
  }
}
