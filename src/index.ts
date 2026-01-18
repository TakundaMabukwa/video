// import express from 'express';
// import { createServer } from 'http';
// import { JTT808Server } from './tcp/server';
// import { UDPRTPServer } from './udp/server';
// import { TCPRTPHandler } from './tcp/rtpHandler';
// import { createRoutes } from './api/routes';
// import { createAlertRoutes } from './api/alertRoutes';
// import { AlertWebSocketServer } from './api/websocket';
// import { DataWebSocketServer } from './api/dataWebsocket';
// import pool from './storage/database';
// import * as dotenv from 'dotenv';

// dotenv.config();

// const DATA_WS_PORT = parseInt(process.env.DATA_WS_PORT || '7080');
// const TCP_PORT = parseInt(process.env.TCP_PORT || '7611');
// const UDP_PORT = parseInt(process.env.UDP_PORT || '6611');
// const API_PORT = parseInt(process.env.API_PORT || '3000');
// const SERVER_IP = process.env.SERVER_IP || 'localhost';

// async function startServer() {
//   console.log('Starting JT/T 1078 Video Ingestion Server...');
  
//   try {
//     await pool.query('SELECT NOW()');
//     console.log('✅ Database connected successfully');
//   } catch (error) {
//     console.error('❌ Database connection failed:', error);
//     process.exit(1);
//   }
  
//   const app = express();
//   app.use(express.json());
//   app.use(express.static('public'));
  
//   const httpServer = createServer(app);
  
//   // Initialize data WebSocket on same HTTP server
//   const dataWsServer = new DataWebSocketServer(httpServer, '/ws/data');
  
//   const tcpServer = new JTT808Server(TCP_PORT, UDP_PORT);
//   const udpServer = new UDPRTPServer(UDP_PORT);
//   const tcpRTPHandler = new TCPRTPHandler();
  
//   const alertManager = tcpServer.getAlertManager();
//   udpServer.setAlertManager(alertManager);
  
//   tcpServer.setRTPHandler((buffer, vehicleId) => {
//     console.log(`📦 RTP: ${buffer.length} bytes from ${vehicleId}`);
//     tcpRTPHandler.handleRTPPacket(buffer, vehicleId);
//     dataWsServer.broadcast({ type: 'rtp', vehicleId, data: buffer.toString('base64'), size: buffer.length });
//   });
  
//   await tcpServer.start();
//   await udpServer.start();
  
//   app.use('/api', createRoutes(tcpServer, udpServer));
//   app.use('/api/alerts', createAlertRoutes());
  
//   app.get('/health', (req, res) => {
//     res.json({
//       status: 'healthy',
//       timestamp: new Date().toISOString(),
//       services: {
//         tcp: `listening on port ${TCP_PORT}`,
//         udp: `listening on port ${UDP_PORT}`,
//         api: `listening on port ${API_PORT}`
//       }
//     });
//   });
  
//   new AlertWebSocketServer(httpServer, alertManager);
  
//   httpServer.listen(API_PORT, () => {
//     console.log(`\n✅ REST API: http://localhost:${API_PORT}`);
//     console.log(`✅ Alert WS: ws://localhost:${API_PORT}/ws/alerts`);
//     console.log(`✅ Data WS: ws://localhost:${API_PORT}/ws/data`);
//     console.log(`✅ TCP: ${TCP_PORT} | UDP: ${UDP_PORT}\n`);
//   });
  
//   process.on('SIGINT', () => {
//     console.log('\nShutting down...');
//     process.exit(0);
//   });
// }

// startServer().catch((error) => {
//   console.error('Failed to start server:', error);
//   process.exit(1);
// });



import express from 'express';
import { createServer } from 'http';
import { JTT808Server } from './tcp/server';
import { UDPRTPServer } from './udp/server';
import { TCPRTPHandler } from './tcp/rtpHandler';
import { createRoutes } from './api/routes';
import { createAlertRoutes } from './api/alertRoutes';
import { AlertWebSocketServer } from './api/websocket';
import { DataWebSocketServer } from './api/dataWebsocket';
import { LiveVideoStreamServer } from './streaming/liveStream';
import pool from './storage/database';
import * as dotenv from 'dotenv';

dotenv.config();

const TCP_PORT = parseInt(process.env.TCP_PORT || '7611');
const UDP_PORT = parseInt(process.env.UDP_PORT || '6611');
const API_PORT = parseInt(process.env.API_PORT || '3000');
const SERVER_IP = process.env.SERVER_IP || 'localhost';

async function startServer() {
  console.log('Starting JT/T 1078 Video Ingestion Server...');
  
  try {
    await pool.query('SELECT NOW()');
    console.log('Database connected successfully');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
  
  const tcpServer = new JTT808Server(TCP_PORT, UDP_PORT);
  const udpServer = new UDPRTPServer(UDP_PORT);
  const tcpRTPHandler = new TCPRTPHandler();
  
  const alertManager = tcpServer.getAlertManager();
  udpServer.setAlertManager(alertManager);
  
  const app = express();
  app.use(express.json());
  app.use(express.static('public'));
  
  const httpServer = createServer(app);
  const dataWsServer = new DataWebSocketServer(httpServer, '/ws/data');
  const liveVideoServer = new LiveVideoStreamServer(httpServer, tcpServer);
  
  // Connect UDP frames to WebSocket broadcast
  udpServer.setFrameCallback((vehicleId, channel, frame, isIFrame) => {
    liveVideoServer.broadcastFrame(vehicleId, channel, frame, isIFrame);
  });
  
  tcpServer.setRTPHandler((buffer, vehicleId) => {
    tcpRTPHandler.handleRTPPacket(buffer, vehicleId);
    dataWsServer.broadcast({
      type: 'RTP_PACKET',
      vehicleId,
      size: buffer.length,
      timestamp: new Date().toISOString()
    });
  });
  
  await tcpServer.start();
  await udpServer.start();
  
  app.use('/api', createRoutes(tcpServer, udpServer));
  app.use('/api/alerts', createAlertRoutes());
  
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
  
  app.get('/api/stream/stats', (req, res) => {
    res.json(liveVideoServer.getStats());
  });
  
  const wsServer = new AlertWebSocketServer(httpServer, alertManager);
  
  httpServer.listen(API_PORT, () => {
    console.log(`REST API server listening on port ${API_PORT}`);
    console.log(`WebSocket - Alerts: ws://localhost:${API_PORT}/ws/alerts`);
    console.log(`WebSocket - Data: ws://localhost:${API_PORT}/ws/data`);
    console.log(`WebSocket - Live Video: ws://localhost:${API_PORT}/ws/video`);
  });
  
  console.log('\n=== JT/T 1078 Video Server Started ===');
  console.log(`TCP: ${TCP_PORT} | UDP: ${UDP_PORT} | API: ${API_PORT}`);
  console.log(`Live Stream: ws://localhost:${API_PORT}/ws/video`);
  console.log('==========================================\n');
  
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