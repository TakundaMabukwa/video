import express from 'express';
import { JTT808Server } from './tcp/server';
import { UDPRTPServer } from './udp/server';
import { TCPRTPHandler } from './tcp/rtpHandler';
import { createRoutes } from './api/routes';

const TCP_PORT = 7611;  // JT/T 808 standard port
const UDP_PORT = 6611;  // JT/T 1078 RTP port
const API_PORT = 3000;  // REST API port

async function startServer() {
  console.log('Starting JT/T 1078 Video Ingestion Server...');
  
  const tcpServer = new JTT808Server(TCP_PORT, UDP_PORT);
  const udpServer = new UDPRTPServer(UDP_PORT);
  const tcpRTPHandler = new TCPRTPHandler();
  
  tcpServer.setRTPHandler((buffer, vehicleId) => {
    tcpRTPHandler.handleRTPPacket(buffer, vehicleId);
  });
  
  await tcpServer.start();
  
  // Start UDP server for JT/T 1078 RTP streams
  await udpServer.start();
  
  // Start REST API server
  const app = express();
  app.use(express.json());
  
  // Serve static files
  app.use(express.static('public'));
  
  // Add routes
  app.use('/api', createRoutes(tcpServer, udpServer));
  
  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        tcp: `listening on port ${TCP_PORT}`,
        udp: `listening on port ${UDP_PORT}`,
        api: `listening on port ${API_PORT}`
      }
    });
  });
  
  app.listen(API_PORT, () => {
    console.log(`REST API server listening on port ${API_PORT}`);
  });
  
  console.log('\n=== JT/T 1078 Video Ingestion Server Started ===');
  console.log(`TCP (JT/T 808): ${TCP_PORT}`);
  console.log(`UDP (JT/T 1078): ${UDP_PORT}`);
  console.log(`REST API: ${API_PORT}`);
  console.log('==============================================\n');
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    process.exit(0);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});