import express from 'express';
import { createServer } from 'http';
import { JTT808Server } from './tcp/server';
import { UDPRTPServer } from './udp/server';
import { TCPRTPHandler } from './tcp/rtpHandler';
import { createRoutes } from './api/routes';
import { createAlertRoutes } from './api/alertRoutes';
import { AlertWebSocketServer } from './api/websocket';
import pool from './storage/database';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TCP_PORT = parseInt(process.env.TCP_PORT || '7611');
const UDP_PORT = parseInt(process.env.UDP_PORT || '6611');
const API_PORT = parseInt(process.env.API_PORT || '3000');
const SERVER_IP = process.env.SERVER_IP || 'localhost';

async function startServer() {
  console.log('Starting JT/T 1078 Video Ingestion Server...');
  
  // Test database connection
  try {
    await pool.query('SELECT NOW()');
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    console.error('Please check your .env file and database configuration');
    process.exit(1);
  }
  
  const tcpServer = new JTT808Server(TCP_PORT, UDP_PORT);
  const udpServer = new UDPRTPServer(UDP_PORT);
  const tcpRTPHandler = new TCPRTPHandler();
  
  // Connect alert manager between TCP and UDP servers
  const alertManager = tcpServer.getAlertManager();
  udpServer.setAlertManager(alertManager);
  
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
  app.use('/api/alerts', createAlertRoutes());
  
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
  
  // Create HTTP server for WebSocket
  const httpServer = createServer(app);
  
  // Initialize WebSocket for real-time alerts
  const wsServer = new AlertWebSocketServer(httpServer, alertManager);
  
  httpServer.listen(API_PORT, () => {
    console.log(`REST API server listening on port ${API_PORT}`);
    console.log(`WebSocket server ready at ws://localhost:${API_PORT}/ws/alerts`);
  });
  
  console.log('\n=== JT/T 1078 Video Ingestion Server Started ===');
  console.log(`TCP (JT/T 808): ${TCP_PORT}`);
  console.log(`UDP (JT/T 1078): ${UDP_PORT}`);
  console.log(`REST API: ${API_PORT}`);
  console.log(`Server IP: ${SERVER_IP}`);
  console.log(`Web UI: http://${SERVER_IP}:${API_PORT}`);
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