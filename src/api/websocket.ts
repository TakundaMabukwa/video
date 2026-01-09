import { Server as WebSocketServer, WebSocket } from 'ws';
import { Server as HTTPServer } from 'http';
import { AlertManager } from '../alerts/alertManager';

export class AlertWebSocketServer {
  private wss: WebSocketServer;
  private clients = new Set<WebSocket>();

  constructor(httpServer: HTTPServer, alertManager: AlertManager) {
    this.wss = new WebSocketServer({ server: httpServer, path: '/ws/alerts' });

    this.wss.on('connection', (ws: WebSocket) => {
      console.log('🔌 WebSocket client connected');
      this.clients.add(ws);

      ws.on('close', () => {
        console.log('🔌 WebSocket client disconnected');
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.clients.delete(ws);
      });

      // Send initial connection message
      ws.send(JSON.stringify({
        type: 'connected',
        message: 'Connected to alert notification system',
        timestamp: new Date()
      }));
    });

    // Listen to alert manager events
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

    console.log('🔔 WebSocket alert notification server initialized');
  }

  private broadcast(message: any): void {
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
