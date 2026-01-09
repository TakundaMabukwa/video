import express from 'express';
import { JTT808Server } from '../tcp/server';
import { UDPRTPServer } from '../udp/server';
import * as path from 'path';

export function createRoutes(tcpServer: JTT808Server, udpServer: UDPRTPServer): express.Router {
  const router = express.Router();

  // Get all connected vehicles with their channels
  router.get('/vehicles', (req, res) => {
    const vehicles = tcpServer.getVehicles();
    res.json({
      success: true,
      data: vehicles.map(v => ({
        id: v.id,
        phone: v.phone,
        connected: v.connected,
        lastHeartbeat: v.lastHeartbeat,
        activeStreams: Array.from(v.activeStreams),
        channels: v.channels || []
      }))
    });
  });

  // Start all video channels for a vehicle
  router.post('/vehicles/:id/start-all-streams', (req, res) => {
    const { id } = req.params;
    const vehicle = tcpServer.getVehicle(id);
    
    if (!vehicle || !vehicle.connected) {
      return res.status(404).json({
        success: false,
        message: `Vehicle ${id} not found or not connected`
      });
    }
    
    const videoChannels = vehicle.channels?.filter(ch => ch.type === 'video' || ch.type === 'audio_video') || [];
    const results = [];
    
    for (const channel of videoChannels) {
      const success = tcpServer.startVideo(id, channel.logicalChannel);
      results.push({
        channel: channel.logicalChannel,
        type: channel.type,
        success
      });
    }
    
    res.json({
      success: true,
      message: `Started ${results.filter(r => r.success).length}/${results.length} video streams`,
      data: results
    });
  });

  // Stop all video channels for a vehicle
  router.post('/vehicles/:id/stop-all-streams', (req, res) => {
    const { id } = req.params;
    const vehicle = tcpServer.getVehicle(id);
    
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: `Vehicle ${id} not found`
      });
    }
    
    const activeChannels = Array.from(vehicle.activeStreams);
    const results = [];
    
    for (const channel of activeChannels) {
      const success = tcpServer.stopVideo(id, channel);
      udpServer.stopStream(id, channel);
      results.push({ channel, success });
    }
    
    res.json({
      success: true,
      message: `Stopped ${results.length} video streams`,
      data: results
    });
  });

  // Start live video for a vehicle
  router.post('/vehicles/:id/start-live', (req, res) => {
    const { id } = req.params;
    const { channel = 1 } = req.body;
    
    console.log(`📡 API: start-live called for vehicle ${id}, channel ${channel}`);
    console.log(`  Request body:`, req.body);
    
    const success = tcpServer.startVideo(id, channel);
    
    if (success) {
      res.json({
        success: true,
        message: `Video stream started for vehicle ${id}, channel ${channel}`
      });
    } else {
      res.status(404).json({
        success: false,
        message: `Vehicle ${id} not found or not connected`
      });
    }
  });

  // Stop live video for a vehicle
  router.post('/vehicles/:id/stop-live', (req, res) => {
    const { id } = req.params;
    const { channel = 1 } = req.body;
    
    const success = tcpServer.stopVideo(id, channel);
    udpServer.stopStream(id, channel);
    
    if (success) {
      res.json({
        success: true,
        message: `Video stream stopped for vehicle ${id}, channel ${channel}`
      });
    } else {
      res.status(404).json({
        success: false,
        message: `Vehicle ${id} not found`
      });
    }
  });

  // Request screenshot from vehicle
  router.post('/vehicles/:id/screenshot', (req, res) => {
    const { id } = req.params;
    const { channel = 1 } = req.body;
    
    const success = tcpServer.requestScreenshot(id, channel);
    
    if (success) {
      res.json({
        success: true,
        message: `Screenshot requested for vehicle ${id}, channel ${channel}`
      });
    } else {
      res.status(404).json({
        success: false,
        message: `Vehicle ${id} not found or not connected`
      });
    }
  });

  // Get stream info for a vehicle
  router.get('/vehicles/:id/stream-info', (req, res) => {
    const { id } = req.params;
    const { channel = 1 } = req.query;
    
    const vehicle = tcpServer.getVehicle(id);
    const streamInfo = udpServer.getStreamInfo(id, Number(channel));
    
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: `Vehicle ${id} not found`
      });
    }

    res.json({
      success: true,
      data: {
        vehicle: {
          id: vehicle.id,
          connected: vehicle.connected,
          lastHeartbeat: vehicle.lastHeartbeat
        },
        stream: streamInfo || {
          vehicleId: id,
          channel: Number(channel),
          active: false,
          frameCount: 0,
          lastFrame: null
        }
      }
    });
  });

  // Get all active streams for a vehicle
  router.get('/vehicles/:id/streams', (req, res) => {
    const { id } = req.params;
    const vehicle = tcpServer.getVehicle(id);
    
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: `Vehicle ${id} not found`
      });
    }
    
    const streams = [];
    for (const channel of vehicle.activeStreams) {
      const streamInfo = udpServer.getStreamInfo(id, channel);
      const channelInfo = vehicle.channels?.find(ch => ch.logicalChannel === channel);
      
      streams.push({
        channel,
        type: channelInfo?.type || 'unknown',
        hasGimbal: channelInfo?.hasGimbal || false,
        streamInfo: streamInfo || {
          vehicleId: id,
          channel,
          active: false,
          frameCount: 0,
          lastFrame: null
        },
        playlistUrl: `/api/stream/${id}/${channel}/playlist.m3u8`
      });
    }
    
    res.json({
      success: true,
      data: {
        vehicleId: id,
        totalChannels: vehicle.channels?.length || 0,
        activeStreams: streams.length,
        streams
      }
    });
  });

  // Query camera capabilities
  router.post('/vehicles/:id/query-capabilities', (req, res) => {
    const { id } = req.params;
    
    const success = tcpServer.queryCapabilities(id);
    
    if (success) {
      res.json({
        success: true,
        message: `Querying capabilities for vehicle ${id}, check logs for response`
      });
    } else {
      res.status(404).json({
        success: false,
        message: `Vehicle ${id} not found or not connected`
      });
    }
  });

  // Get server statistics
  router.get('/stats', (req, res) => {
    const vehicles = tcpServer.getVehicles();
    const udpStats = udpServer.getStats();
    
    res.json({
      success: true,
      data: {
        connectedVehicles: vehicles.filter(v => v.connected).length,
        totalVehicles: vehicles.length,
        activeStreams: udpStats.activeStreams,
        totalStreams: udpStats.totalStreams,
        frameAssembler: udpStats.frameAssemblerStats
      }
    });
  });

  // Serve HLS playlist
  router.get('/stream/:vehicleId/:channel/playlist.m3u8', (req, res) => {
    const { vehicleId, channel } = req.params;
    const playlistPath = path.join(process.cwd(), 'hls', vehicleId, `channel_${channel}`, 'playlist.m3u8');
    res.sendFile(playlistPath);
  });

  // Serve HLS segments
  router.get('/stream/:vehicleId/:channel/:segment', (req, res) => {
    const { vehicleId, channel, segment } = req.params;
    const segmentPath = path.join(process.cwd(), 'hls', vehicleId, `channel_${channel}`, segment);
    res.sendFile(segmentPath);
  });

  // Get alerts
  router.get('/alerts', (req, res) => {
    const alerts = tcpServer.getAlerts();
    res.json({
      success: true,
      data: alerts
    });
  });

  // Get vehicle images
  router.get('/vehicles/:id/images', async (req, res) => {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    
    try {
      const result = await require('../storage/database').query(
        `SELECT id, device_id, channel, storage_url, file_size, timestamp 
         FROM images 
         WHERE device_id = $1 
         ORDER BY timestamp DESC 
         LIMIT $2`,
        [id, limit]
      );
      
      res.json({ 
        success: true, 
        data: result.rows.map((img: any) => ({
          id: img.id,
          deviceId: img.device_id,
          channel: img.channel,
          url: img.storage_url,
          fileSize: img.file_size,
          timestamp: img.timestamp
        }))
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch images' });
    }
  });

  // Serve media files
  router.get('/media/:vehicleId/:filename', (req, res) => {
    const { vehicleId, filename } = req.params;
    const { download } = req.query;
    const filePath = path.join(process.cwd(), 'media', vehicleId, filename);
    
    if (require('fs').existsSync(filePath)) {
      // Set proper content type for images
      if (filename.match(/\.(jpg|jpeg)$/i)) {
        res.setHeader('Content-Type', 'image/jpeg');
      } else if (filename.match(/\.png$/i)) {
        res.setHeader('Content-Type', 'image/png');
      } else if (filename.match(/\.mp4$/i)) {
        res.setHeader('Content-Type', 'video/mp4');
      }
      
      if (download === 'true') {
        res.download(filePath, filename);
      } else {
        res.sendFile(path.resolve(filePath));
      }
    } else {
      res.status(404).json({ success: false, message: 'File not found' });
    }
  });

  // Get all images from all vehicles
  router.get('/images', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const result = await require('../storage/database').query(
        `SELECT id, device_id, channel, storage_url, file_size, timestamp 
         FROM images 
         ORDER BY timestamp DESC 
         LIMIT $1`,
        [limit]
      );
      
      res.json({ 
        success: true, 
        total: result.rows.length,
        data: result.rows.map((img: any) => ({
          id: img.id,
          deviceId: img.device_id,
          channel: img.channel,
          url: img.storage_url,
          fileSize: img.file_size,
          timestamp: img.timestamp
        }))
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch images' });
    }
  });

  // Get all devices
  router.get('/devices', (req, res) => {
    const devices = tcpServer.getDevices();
    res.json({
      success: true,
      total: devices.length,
      data: devices
    });
  });

  // === ALERT MANAGEMENT ENDPOINTS ===
  
  // Get active alerts
  router.get('/alerts/active', (req, res) => {
    const alertManager = tcpServer.getAlertManager();
    const alerts = alertManager.getActiveAlerts();
    res.json({
      success: true,
      total: alerts.length,
      data: alerts
    });
  });

  // Get alert by ID
  router.get('/alerts/:id', (req, res) => {
    const { id } = req.params;
    const alertManager = tcpServer.getAlertManager();
    const alert = alertManager.getAlertById(id);
    
    if (!alert) {
      return res.status(404).json({
        success: false,
        message: `Alert ${id} not found`
      });
    }
    
    res.json({
      success: true,
      data: alert
    });
  });

  // Acknowledge alert
  router.post('/alerts/:id/acknowledge', (req, res) => {
    const { id } = req.params;
    const alertManager = tcpServer.getAlertManager();
    const success = alertManager.acknowledgeAlert(id);
    
    if (success) {
      res.json({
        success: true,
        message: `Alert ${id} acknowledged`
      });
    } else {
      res.status(404).json({
        success: false,
        message: `Alert ${id} not found or already acknowledged`
      });
    }
  });

  // Resolve alert
  router.post('/alerts/:id/resolve', (req, res) => {
    const { id } = req.params;
    const alertManager = tcpServer.getAlertManager();
    const success = alertManager.resolveAlert(id);
    
    if (success) {
      res.json({
        success: true,
        message: `Alert ${id} resolved`
      });
    } else {
      res.status(404).json({
        success: false,
        message: `Alert ${id} not found`
      });
    }
  });

  // Manually escalate alert
  router.post('/alerts/:id/escalate', (req, res) => {
    const { id } = req.params;
    const alertManager = tcpServer.getAlertManager();
    const success = alertManager.escalateAlert(id);
    
    if (success) {
      res.json({
        success: true,
        message: `Alert ${id} escalated`
      });
    } else {
      res.status(404).json({
        success: false,
        message: `Alert ${id} not found`
      });
    }
  });

  // Get alert statistics
  router.get('/alerts/stats', (req, res) => {
    const alertManager = tcpServer.getAlertManager();
    const stats = alertManager.getAlertStats();
    res.json({
      success: true,
      data: stats
    });
  });

  // Get video clip for alert
  router.get('/alerts/:id/video', (req, res) => {
    const { id } = req.params;
    const alertManager = tcpServer.getAlertManager();
    const alert = alertManager.getAlertById(id);
    
    if (!alert || !alert.videoClipPath) {
      return res.status(404).json({
        success: false,
        message: 'Video clip not found'
      });
    }
    
    if (require('fs').existsSync(alert.videoClipPath)) {
      res.sendFile(path.resolve(alert.videoClipPath));
    } else {
      res.status(404).json({
        success: false,
        message: 'Video file not found on disk'
      });
    }
  });

  // Get buffer statistics
  router.get('/alerts/buffers/stats', (req, res) => {
    const alertManager = tcpServer.getAlertManager();
    const stats = alertManager.getBufferStats();
    res.json({
      success: true,
      data: stats
    });
  });

  return router;
}