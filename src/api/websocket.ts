import { Server as WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { AlertManager } from '../alerts/alertManager';

export class AlertWebSocketServer {
  private wss: WebSocketServer;
  private clients = new Set<WebSocket>();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private path: string;

  constructor(alertManager: AlertManager, path = '/ws/alerts') {
    this.path = path;
    this.wss = new WebSocketServer({
      noServer: true,
      perMessageDeflate: {
        zlibDeflateOptions: { chunkSize: 1024, memLevel: 7, level: 3 },
        zlibInflateOptions: { chunkSize: 10 * 1024 },
        threshold: 1024
      }
    });

    this.wss.on('connection', (ws: WebSocket) => {
      console.log('Alert WebSocket client connected');
      (ws as any).isAlive = true;
      this.clients.add(ws);

      ws.on('pong', () => {
        (ws as any).isAlive = true;
      });

      ws.on('close', () => {
        console.log('Alert WebSocket client disconnected');
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('Alert WebSocket error:', error);
        this.clients.delete(ws);
      });

      ws.send(JSON.stringify({
        type: 'connected',
        message: 'Connected to alert notification system',
        timestamp: new Date(),
        activeAlertCount: alertManager.getActiveAlerts().length
      }));

      ws.send(JSON.stringify({
        type: 'active_alerts_snapshot',
        data: alertManager.getActiveAlerts(),
        timestamp: new Date()
      }));
    });

    alertManager.on('notification', (notification) => {
      this.broadcast(notification);
    });

    alertManager.on('alert', (alert) => {
      this.broadcast({
        type: 'new_alert',
        data: alert
      });
    });

    alertManager.on('alert-acknowledged', (alert) => {
      this.broadcast({
        type: 'alert_acknowledged',
        data: alert
      });
    });

    alertManager.on('alert-escalated', (alert) => {
      this.broadcast({
        type: 'alert_escalated',
        data: alert
      });
    });

    alertManager.on('alert-resolved', (alert) => {
      this.broadcast({
        type: 'alert_resolved',
        data: alert
      });
    });

    this.heartbeatTimer = setInterval(() => {
      this.clients.forEach((client) => {
        if ((client as any).isAlive === false) {
          try { client.terminate(); } catch {}
          this.clients.delete(client);
          return;
        }
        (client as any).isAlive = false;
        try { client.ping(); } catch {}
      });
    }, 25000);

    this.wss.on('close', () => {
      if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    });

    console.log(`Alert WebSocket server initialized on ${this.path}`);
  }

  public getPath(): string {
    return this.path;
  }

  public handleUpgrade(request: IncomingMessage, socket: any, head: Buffer): void {
    this.wss.handleUpgrade(request, socket, head, (ws) => {
      this.wss.emit('connection', ws, request);
    });
  }

  public broadcast(message: any): void {
    const payload = JSON.stringify(message);

    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }

  getClientCount(): number {
    return this.clients.size;
  }
}
