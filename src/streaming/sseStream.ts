import { Request, Response } from 'express';
import { JTT808Server } from '../tcp/server';

interface SSEClient {
  vehicleId: string;
  channel: number;
  res: Response;
}

export class SSEVideoStream {
  private clients: SSEClient[] = [];
  private tcpServer: JTT808Server;

  constructor(tcpServer: JTT808Server) {
    this.tcpServer = tcpServer;
  }

  handleConnection(req: Request, res: Response) {
    const { vehicleId, channel = '1' } = req.query;
    
    if (!vehicleId) {
      return res.status(400).json({ error: 'vehicleId required' });
    }

    const channelNum = parseInt(channel as string);
    
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    res.write('data: {"type":"connected"}\n\n');

    const client: SSEClient = {
      vehicleId: vehicleId as string,
      channel: channelNum,
      res
    };

    this.clients.push(client);
    this.tcpServer.startVideo(vehicleId as string, channelNum);

    console.log(`SSE client connected: ${vehicleId}_${channelNum}`);

    req.on('close', () => {
      this.clients = this.clients.filter(c => c.res !== res);
      console.log(`SSE client disconnected: ${vehicleId}_${channelNum}`);
      
      const remaining = this.clients.filter(c => 
        c.vehicleId === vehicleId && c.channel === channelNum
      );
      
      if (remaining.length === 0) {
        this.tcpServer.stopVideo(vehicleId as string, channelNum);
      }
    });
  }

  broadcastFrame(vehicleId: string, channel: number, frame: Buffer, isIFrame: boolean) {
    const clients = this.clients.filter(c => 
      c.vehicleId === vehicleId && c.channel === channel
    );

    if (clients.length === 0) return;

    const data = JSON.stringify({
      type: 'frame',
      vehicleId,
      channel,
      data: frame.toString('base64'),
      size: frame.length,
      isIFrame,
      timestamp: Date.now()
    });

    for (const client of clients) {
      try {
        client.res.write(`data: ${data}\n\n`);
      } catch (error) {
        console.error('SSE write error:', error);
      }
    }
  }

  getStats() {
    const stats: any = {};
    for (const client of this.clients) {
      const key = `${client.vehicleId}_${client.channel}`;
      stats[key] = (stats[key] || 0) + 1;
    }
    return stats;
  }
}
