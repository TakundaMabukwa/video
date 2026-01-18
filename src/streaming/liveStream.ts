import WebSocket from 'ws';
import { Server as HttpServer } from 'http';
import { JTT808Server } from '../tcp/server';

interface StreamSubscription {
  vehicleId: string;
  channel: number;
  ws: WebSocket;
  lastFrame: Date;
}

export class LiveVideoStreamServer {
  private wss: WebSocket.Server;
  private subscriptions = new Map<string, StreamSubscription[]>();
  private tcpServer: JTT808Server;

  constructor(httpServer: HttpServer, tcpServer: JTT808Server) {
    this.tcpServer = tcpServer;
    this.wss = new WebSocket.Server({ 
      server: httpServer, 
      path: '/ws/video'
    });

    this.wss.on('connection', (ws) => {
      console.log('Video stream client connected');

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          this.handleClientMessage(ws, msg);
        } catch (error) {
          console.error('Invalid message:', error);
        }
      });

      ws.on('close', () => {
        this.unsubscribeAll(ws);
        console.log('Video stream client disconnected');
      });
    });

    console.log('Live video stream WebSocket ready at /ws/video');
  }

  private handleClientMessage(ws: WebSocket, msg: any) {
    switch (msg.type) {
      case 'subscribe':
        this.subscribe(ws, msg.vehicleId, msg.channel || 1);
        break;
      case 'unsubscribe':
        this.unsubscribe(ws, msg.vehicleId, msg.channel || 1);
        break;
    }
  }

  private subscribe(ws: WebSocket, vehicleId: string, channel: number) {
    const key = `${vehicleId}_${channel}`;
    
    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, []);
      this.tcpServer.startVideo(vehicleId, channel);
      console.log(`Started video stream: ${key}`);
    }

    const subs = this.subscriptions.get(key)!;
    if (!subs.find(s => s.ws === ws)) {
      subs.push({ vehicleId, channel, ws, lastFrame: new Date() });
      ws.send(JSON.stringify({ type: 'subscribed', vehicleId, channel }));
      console.log(`Client subscribed to ${key}`);
    }
  }

  private unsubscribe(ws: WebSocket, vehicleId: string, channel: number) {
    const key = `${vehicleId}_${channel}`;
    const subs = this.subscriptions.get(key);
    
    if (subs) {
      const filtered = subs.filter(s => s.ws !== ws);
      
      if (filtered.length === 0) {
        this.subscriptions.delete(key);
        this.tcpServer.stopVideo(vehicleId, channel);
        console.log(`Stopped video stream: ${key}`);
      } else {
        this.subscriptions.set(key, filtered);
      }
    }
  }

  private unsubscribeAll(ws: WebSocket) {
    for (const [key, subs] of this.subscriptions.entries()) {
      const filtered = subs.filter(s => s.ws !== ws);
      
      if (filtered.length === 0) {
        this.subscriptions.delete(key);
        const [vehicleId, channel] = key.split('_');
        this.tcpServer.stopVideo(vehicleId, parseInt(channel));
      } else {
        this.subscriptions.set(key, filtered);
      }
    }
  }

  broadcastFrame(vehicleId: string, channel: number, frame: Buffer, isIFrame: boolean) {
    const key = `${vehicleId}_${channel}`;
    const subs = this.subscriptions.get(key);
    
    if (!subs || subs.length === 0) return;

    const message = JSON.stringify({
      type: 'frame',
      vehicleId,
      channel,
      data: frame.toString('base64'),
      size: frame.length,
      isIFrame,
      timestamp: Date.now()
    });

    let sent = 0;
    for (const sub of subs) {
      if (sub.ws.readyState === WebSocket.OPEN) {
        sub.ws.send(message);
        sub.lastFrame = new Date();
        sent++;
      }
    }

    if (sent > 0 && isIFrame) {
      console.log(`Broadcast I-frame to ${sent} clients: ${key}`);
    }
  }

  getStats() {
    const stats: any = {};
    for (const [key, subs] of this.subscriptions.entries()) {
      stats[key] = {
        subscribers: subs.length,
        lastFrame: subs[0]?.lastFrame
      };
    }
    return stats;
  }
}
