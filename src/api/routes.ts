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