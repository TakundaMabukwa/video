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

  return router;
}

// Get alerts
router.get('/alerts', (req, res) => {
  const alerts = tcpServer.getAlerts();
  res.json({
    success: true,
    data: alerts
  });
});

// Get vehicle images
router.get('/vehicles/:id/images', (req, res) => {
  const { id } = req.params;
  const mediaDir = path.join(process.cwd(), 'media', id);
  
  try {
    if (!require('fs').existsSync(mediaDir)) {
      return res.json({ success: true, data: [] });
    }
    
    const files = require('fs').readdirSync(mediaDir)
      .filter((file: string) => file.match(/\.(jpg|jpeg|png|mp4|avi)$/i))
      .map((file: string) => ({
        filename: file,
        url: `/api/media/${id}/${file}`,
        timestamp: file.split('_')[2]?.replace(/-/g, ':') || 'unknown'
      }));
    
    res.json({ success: true, data: files });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to read images' });
  }
});

// Serve media files
router.get('/media/:vehicleId/:filename', (req, res) => {
  const { vehicleId, filename } = req.params;
  const { download } = req.query;
  const filePath = path.join(process.cwd(), 'media', vehicleId, filename);
  
  if (require('fs').existsSync(filePath)) {
    if (download === 'true') {
      res.download(filePath);
    } else {
      res.sendFile(filePath);
    }
  } else {
    res.status(404).json({ success: false, message: 'File not found' });
  }
});

// Get all images from all vehicles
router.get('/images', (req, res) => {
  const mediaDir = path.join(process.cwd(), 'media');
  const allImages: any[] = [];
  
  try {
    if (!require('fs').existsSync(mediaDir)) {
      return res.json({ success: true, data: [] });
    }
    
    const vehicleDirs = require('fs').readdirSync(mediaDir, { withFileTypes: true })
      .filter((dirent: any) => dirent.isDirectory())
      .map((dirent: any) => dirent.name);
    
    for (const vehicleId of vehicleDirs) {
      const vehicleMediaDir = path.join(mediaDir, vehicleId);
      const files = require('fs').readdirSync(vehicleMediaDir)
        .filter((file: string) => file.match(/\.(jpg|jpeg|png|mp4|avi)$/i))
        .map((file: string) => ({
          vehicleId,
          filename: file,
          viewUrl: `/api/media/${vehicleId}/${file}`,
          downloadUrl: `/api/media/${vehicleId}/${file}?download=true`,
          timestamp: file.split('_')[2]?.replace(/-/g, ':') || 'unknown',
          channel: file.split('_')[1]?.replace('ch', '') || '1',
          eventCode: file.split('_')[3]?.split('.')[0]?.replace('event', '') || '0'
        }));
      
      allImages.push(...files);
    }
    
    allImages.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    
    res.json({ 
      success: true, 
      total: allImages.length,
      data: allImages 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to read images' });
  }
});