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
    
    console.log(`📡 SSE connection request: vehicleId=${vehicleId}, channel=${channel}`);
    
    if (!vehicleId) {
      console.log('❌ SSE rejected: no vehicleId');
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
    console.log(`✅ SSE client registered: ${vehicleId}_${channelNum}, total clients: ${this.clients.length}`);
    
    const started = this.tcpServer.startVideo(vehicleId as string, channelNum);
    console.log(`   Video start result: ${started}`);

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
    console.log(`📡 SSE broadcastFrame called: ${vehicleId}_${channel}, clients=${this.clients.length}`);
    
    // BROADCAST TO ALL CLIENTS (ignore filter for testing)
    if (this.clients.length === 0) {
      console.log('   ⚠️ No SSE clients connected');
      return;
    }

    const data = JSON.stringify({
      type: 'frame',
      vehicleId,
      channel,
      data: frame.toString('base64'),
      size: frame.length,
      isIFrame,
      timestamp: Date.now()
    });

    console.log(`   📤 Broadcasting to ALL ${this.clients.length} clients`);
    for (const client of this.clients) {
      try {
        client.res.write(`data: ${data}\n\n`);
        console.log(`   ✅ Sent to client ${client.vehicleId}_${client.channel}`);
      } catch (error) {
        console.error('   ❌ SSE write error:', error);
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
