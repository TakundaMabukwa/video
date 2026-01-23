import express from 'express';
import { JTT808Server } from '../tcp/server';
import { UDPRTPServer } from '../udp/server';
import { SpeedingManager } from '../services/speedingManager';
import * as path from 'path';

export function createRoutes(tcpServer: JTT808Server, udpServer: UDPRTPServer): express.Router {
  const router = express.Router();
  const speedingManager = new SpeedingManager();

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

    const success = tcpServer.startVideo(id, channel);
    if (success) {
      udpServer.startHLSStream(id, channel);
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

  // Optimize camera video parameters
  router.post('/vehicles/:id/optimize-video', (req, res) => {
    const { id } = req.params;
    const { channel = 1 } = req.body;

    const success = tcpServer.optimizeVideoParameters(id, channel);

    if (success) {
      res.json({
        success: true,
        message: `Camera optimized for ${id} channel ${channel}`,
        settings: {
          resolution: 'CIF (352x288)',
          frameRate: '15 fps',
          bitrate: '512 kbps',
          speedup: '3-5x faster'
        }
      });
    } else {
      res.status(404).json({
        success: false,
        message: `Vehicle ${id} not found`
      });
    }
  });

  // Switch stream quality
  router.post('/vehicles/:id/switch-stream', (req, res) => {
    const { id } = req.params;
    const { channel = 1, streamType = 1 } = req.body; // 0=main, 1=sub

    const success = tcpServer.switchStream(id, channel, streamType);

    if (success) {
      res.json({
        success: true,
        message: `Switched to ${streamType === 0 ? 'main' : 'sub'} stream for vehicle ${id}, channel ${channel}`
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

    // Also stop TCP RTP handler stream
    const tcpRTPHandler = (tcpServer as any).rtpHandler;
    if (tcpRTPHandler?.stopStream) {
      tcpRTPHandler.stopStream(id, channel);
    }

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
    const alertManager = tcpServer.getAlertManager();
    const allAlerts = alertManager.getActiveAlerts();
    
    // Apply filters
    const status = req.query.status as string;
    const priority = req.query.priority as string;
    const limit = parseInt(req.query.limit as string) || 100;
    
    let filtered = allAlerts;
    
    if (status) {
      filtered = filtered.filter(a => a.status === status);
    }
    
    if (priority) {
      filtered = filtered.filter(a => a.priority === priority);
    }
    
    filtered = filtered.slice(0, limit);
    
    res.json({
      success: true,
      alerts: filtered,
      count: filtered.length
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
  router.get('/devices', async (req, res) => {
    const devices = await tcpServer.getDevices();
    res.json({
      success: true,
      total: devices.length,
      data: devices
    });
  });

  // === ALERT MANAGEMENT ENDPOINTS ===
  // IMPORTANT: Specific routes MUST come BEFORE parameterized routes (/alerts/:id)

  // Get active alerts
  router.get('/alerts/active', (req, res) => {
    const alertManager = tcpServer.getAlertManager();
    const alerts = alertManager.getActiveAlerts();
    res.json({
      success: true,
      alerts: alerts,
      count: alerts.length
    });
  });

  // Get alert statistics (moved before :id)
  router.get('/alerts/stats', (req, res) => {
    const alertManager = tcpServer.getAlertManager();
    const stats = alertManager.getAlertStats();
    res.json({
      success: true,
      stats: {
        total: stats.total,
        byStatus: {
          new: stats.new,
          acknowledged: stats.acknowledged,
          escalated: stats.escalated,
          resolved: stats.resolved
        },
        byPriority: stats.byPriority
      }
    });
  });

  // Get unresolved alerts
  router.get('/alerts/unresolved', async (req, res) => {
    try {
      const result = await require('../storage/database').query(
        `SELECT a.*, 
                EXTRACT(EPOCH FROM (NOW() - a.timestamp))/60 as minutes_open
         FROM alerts a
         WHERE status IN ('new', 'acknowledged', 'escalated')
         ORDER BY timestamp DESC`
      );
      res.json({ success: true, total: result.rows.length, data: result.rows });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch unresolved alerts' });
    }
  });

  // Get driver behavior alerts
  router.get('/alerts/driver-behavior', async (req, res) => {
    try {
      const result = await require('../storage/database').query(
        `SELECT * FROM alerts 
         WHERE alert_type IN ('Driver Fatigue', 'Phone Call While Driving', 'Smoking While Driving')
         ORDER BY timestamp DESC LIMIT 100`
      );
      res.json({ success: true, total: result.rows.length, data: result.rows });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch driver behavior alerts' });
    }
  });

  // Get alerts by device
  router.get('/alerts/by-device', async (req, res) => {
    try {
      const result = await require('../storage/database').query(
        `SELECT device_id, COUNT(*) as total_alerts,
                COUNT(*) FILTER (WHERE status = 'new') as new_alerts,
                COUNT(*) FILTER (WHERE priority = 'critical') as critical_alerts,
                MAX(timestamp) as last_alert_time
         FROM alerts
         GROUP BY device_id
         ORDER BY MAX(timestamp) DESC`
      );
      res.json({ success: true, total: result.rows.length, data: result.rows });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch alerts by device' });
    }
  });

  // Get alert history
  router.get('/alerts/history', async (req, res) => {
    try {
      const { device_id, days = 7 } = req.query;
      let query = `SELECT * FROM alerts WHERE timestamp > NOW() - INTERVAL '${days} days'`;
      const params: any[] = [];
      if (device_id) {
        query += ' AND device_id = $1';
        params.push(device_id);
      }
      query += ' ORDER BY timestamp DESC';
      const result = await require('../storage/database').query(query, params);
      res.json({ success: true, total: result.rows.length, data: result.rows });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch alert history' });
    }
  });

  // Get alerts grouped by priority (moved before :id)
  router.get('/alerts/by-priority', (req, res) => {
    const alertManager = tcpServer.getAlertManager();
    const alerts = alertManager.getActiveAlerts();

    const grouped = {
      critical: alerts.filter(a => a.priority === 'critical'),
      high: alerts.filter(a => a.priority === 'high'),
      medium: alerts.filter(a => a.priority === 'medium'),
      low: alerts.filter(a => a.priority === 'low')
    };

    res.json({
      success: true,
      alertsByPriority: grouped,
      counts: {
        critical: grouped.critical.length,
        high: grouped.high.length,
        medium: grouped.medium.length,
        low: grouped.low.length,
        total: alerts.length
      }
    });
  });

  // Get unattended alerts (moved before :id)
  router.get('/alerts/unattended', async (req, res) => {
    const minutesThreshold = parseInt(req.query.minutes as string) || 30;

    try {
      const alertStorage = require('../storage/alertStorageDB');
      const alerts = await new alertStorage.AlertStorageDB().getUnattendedAlerts(minutesThreshold);

      res.json({
        success: true,
        unattendedAlerts: alerts,
        count: alerts.length,
        threshold_minutes: minutesThreshold
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch unattended alerts'
      });
    }
  });

  // Get buffer statistics (moved before :id)
  router.get('/alerts/buffers/stats', (req, res) => {
    const alertManager = tcpServer.getAlertManager();
    const stats = alertManager.getBufferStats();
    res.json({
      success: true,
      data: stats
    });
  });

  // Get alert by ID
  router.get('/alerts/:id', async (req, res) => {
    const { id } = req.params;
    const alertManager = tcpServer.getAlertManager();
    const alert = alertManager.getAlertById(id);

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: `Alert ${id} not found`
      });
    }

    // Get associated screenshots
    try {
      const screenshots = await require('../storage/database').query(
        `SELECT id, storage_url, timestamp 
         FROM images 
         WHERE alert_id = $1 
         ORDER BY timestamp ASC`,
        [id]
      );

      res.json({
        success: true,
        alert: {
          ...alert,
          screenshots: screenshots.rows
        }
      });
    } catch (error) {
      res.json({
        success: true,
        alert: alert
      });
    }
  });

  // Acknowledge alert
  router.post('/alerts/:id/acknowledge', async (req, res) => {
    const { id } = req.params;
    const alertManager = tcpServer.getAlertManager();
    const success = await alertManager.acknowledgeAlert(id);

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
  router.post('/alerts/:id/resolve', async (req, res) => {
    const { id } = req.params;
    const alertManager = tcpServer.getAlertManager();
    const success = await alertManager.resolveAlert(id);

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
  router.post('/alerts/:id/escalate', async (req, res) => {
    const { id } = req.params;
    const alertManager = tcpServer.getAlertManager();
    const success = await alertManager.escalateAlert(id);

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

  // Get alert history
  router.get('/alerts/:id/history', async (req, res) => {
    const { id } = req.params;
    try {
      const db = require('../storage/database');

      // Get alert and its history from database
      const [alertResult, historyResult] = await Promise.all([
        db.query('SELECT * FROM alerts WHERE id = $1', [id]),
        db.query(
          `SELECT action_type, action_by, action_at, notes 
           FROM alert_history 
           WHERE alert_id = $1 
           ORDER BY action_at DESC`,
          [id]
        ).catch(() => ({ rows: [] })) // Table may not exist
      ]);

      if (alertResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: `Alert ${id} not found`
        });
      }

      const alert = alertResult.rows[0];

      // Build history from alert data if history table is empty
      const history = historyResult.rows.length > 0 ? historyResult.rows : [
        { action_type: 'created', action_at: alert.timestamp, notes: null },
        ...(alert.acknowledged_at ? [{ action_type: 'acknowledged', action_at: alert.acknowledged_at, notes: null }] : []),
        ...(alert.escalated_at ? [{ action_type: 'escalated', action_at: alert.escalated_at, notes: null }] : []),
        ...(alert.resolved_at ? [{ action_type: 'resolved', action_at: alert.resolved_at, notes: alert.resolution_notes }] : [])
      ];

      res.json({
        success: true,
        data: {
          alert_id: id,
          device_id: alert.device_id,
          alert_type: alert.alert_type,
          priority: alert.priority,
          status: alert.status,
          history
        }
      });
    } catch (error) {
      console.error('Error fetching alert history:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch alert history'
      });
    }
  });

  // Get all videos for alert (pre-event, post-event, camera SD)
  router.get('/alerts/:id/videos', async (req, res) => {
    const { id } = req.params;

    try {
      const db = require('../storage/database');

      // Get alert with metadata
      const alertResult = await db.query(
        `SELECT id, device_id, channel, alert_type, timestamp, metadata 
         FROM alerts WHERE id = $1`,
        [id]
      );

      if (alertResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: `Alert ${id} not found`
        });
      }

      const alert = alertResult.rows[0];

      // Get linked videos from videos table
      const videosResult = await db.query(
        `SELECT id, file_path, storage_url, file_size, start_time, end_time, 
                duration_seconds, video_type, created_at
         FROM videos 
         WHERE alert_id = $1 
         ORDER BY video_type, start_time`,
        [id]
      );

      // Extract video paths from metadata
      const videoClips = alert.metadata?.videoClips || {};

      res.json({
        success: true,
        alert_id: id,
        device_id: alert.device_id,
        channel: alert.channel,
        alert_type: alert.alert_type,
        timestamp: alert.timestamp,
        videos: {
          // From metadata (immediate paths)
          pre_event: {
            path: videoClips.pre || null,
            frames: videoClips.preFrameCount || 0,
            duration: videoClips.preDuration || 0,
            description: '30 seconds before alert (from circular buffer)'
          },
          post_event: {
            path: videoClips.post || null,
            frames: videoClips.postFrameCount || 0,
            duration: videoClips.postDuration || 0,
            description: '30 seconds after alert (recorded live)'
          },
          camera_sd: {
            path: videoClips.cameraVideo || null,
            description: 'Retrieved from camera SD card (most reliable)'
          },
          // From videos table (database records)
          database_records: videosResult.rows
        },
        total_videos: videosResult.rows.length,
        has_pre_event: !!videoClips.pre,
        has_post_event: !!videoClips.post,
        has_camera_video: !!videoClips.cameraVideo
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch alert videos'
      });
    }
  });

  // TEST: Query resource list (0x9205)
  router.post('/vehicles/:id/test-query-resources', (req, res) => {
    const { id } = req.params;
    const { channel = 1, minutesBack = 5 } = req.body;

    const vehicle = tcpServer.getVehicle(id);
    if (!vehicle || !vehicle.connected) {
      return res.status(404).json({ success: false, message: 'Vehicle not connected' });
    }

    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - minutesBack * 60000);

    const success = tcpServer.queryResourceList(id, channel, startTime, endTime);
    res.json({
      success,
      message: success ? 'Query sent, check logs for 0x1205 response' : 'Failed to send query'
    });
  });

  // TEST: Request playback (0x9201)
  router.post('/vehicles/:id/test-playback', (req, res) => {
    const { id } = req.params;
    const { channel = 1, minutesBack = 1 } = req.body;

    const vehicle = tcpServer.getVehicle(id);
    if (!vehicle || !vehicle.connected) {
      return res.status(404).json({ success: false, message: 'Vehicle not connected' });
    }

    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - minutesBack * 60000);

    const success = tcpServer.requestCameraVideo(id, channel, startTime, endTime);
    res.json({
      success,
      message: success ? 'Playback request sent, check logs for RTP data' : 'Failed to send request'
    });
  });

  // TEST: Simulate alert to test 30s video capture
  router.post('/test/simulate-alert', async (req, res) => {
    const { vehicleId, channel = 1, alertType = 'fatigue', fatigueLevel = 85 } = req.body;

    if (!vehicleId) {
      return res.status(400).json({
        success: false,
        message: 'vehicleId is required. Use a vehicleId that is currently streaming video.'
      });
    }

    const alertManager = tcpServer.getAlertManager();
    const bufferStats = alertManager.getBufferStats();
    const bufferKey = `${vehicleId}_${channel}`;

    if (!bufferStats[bufferKey] || bufferStats[bufferKey].totalFrames === 0) {
      return res.status(400).json({
        success: false,
        message: `No video frames in buffer for ${bufferKey}. Start video streaming first and wait 30s for buffer to fill.`,
        bufferStats
      });
    }

    // Create a simulated location alert
    const simulatedAlert = {
      vehicleId,
      timestamp: new Date(),
      latitude: 0,
      longitude: 0,
      drivingBehavior: {
        fatigue: alertType === 'fatigue',
        phoneCall: alertType === 'phone',
        smoking: alertType === 'smoking',
        custom: 0,
        fatigueLevel: alertType === 'fatigue' ? fatigueLevel : 0
      }
    };

    // Process through alert manager
    await alertManager.processAlert(simulatedAlert as any);

    res.json({
      success: true,
      message: `Alert simulated for ${vehicleId} channel ${channel}. Check recordings/${vehicleId}/alerts/ for video clips.`,
      bufferBefore: bufferStats[bufferKey],
      note: 'Pre-event video saved immediately. Post-event video will be saved in ~35 seconds.'
    });
  });

  // Check buffer status for all streams
  router.get('/buffers/status', (req, res) => {
    const alertManager = tcpServer.getAlertManager();
    const stats = alertManager.getBufferStats();

    const summary = Object.entries(stats).map(([key, value]: [string, any]) => ({
      stream: key,
      frames: value.totalFrames,
      duration: `${value.bufferDuration?.toFixed(1) || 0}s`,
      oldest: value.oldestFrame,
      newest: value.newestFrame,
      isRecordingPostEvent: value.isRecordingPostEvent,
      postEventAlertId: value.postEventAlertId
    }));

    res.json({
      success: true,
      totalBuffers: Object.keys(stats).length,
      data: summary
    });
  });

  // === NEW REQUIREMENTS ENDPOINTS ===

  // Resolve alert with required notes
  router.post('/alerts/:id/resolve-with-notes', async (req, res) => {
    const { id } = req.params;
    const { notes, resolvedBy } = req.body;

    if (!notes || notes.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Resolution notes required (minimum 10 characters)'
      });
    }

    const alertManager = tcpServer.getAlertManager();
    const success = await alertManager.resolveAlert(id, notes, resolvedBy);

    if (success) {
      res.json({
        success: true,
        message: `Alert ${id} resolved with notes`
      });
    } else {
      res.status(404).json({
        success: false,
        message: `Alert ${id} not found`
      });
    }
  });

  // Mark alert as false alert
  router.post('/alerts/:id/mark-false', async (req, res) => {
    const { id } = req.params;
    const { reason, markedBy } = req.body;

    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Reason required (minimum 10 characters)'
      });
    }

    try {
      const alertStorage = require('../storage/alertStorageDB');
      await new alertStorage.AlertStorageDB().markAsFalseAlert(id, reason, markedBy);

      res.json({
        success: true,
        message: `Alert ${id} marked as false alert`
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to mark alert as false'
      });
    }
  });

  // [REMOVED] /alerts/unattended - moved before /alerts/:id
  // [REMOVED] /alerts/by-priority - moved before /alerts/:id

  // Get screenshots for review (auto-refresh endpoint)
  router.get('/screenshots/recent', async (req, res) => {
    const limit = parseInt(req.query.limit as string) || 50;
    const alertsOnly = req.query.alertsOnly === 'true';

    try {
      const query = alertsOnly
        ? `SELECT * FROM images WHERE alert_id IS NOT NULL ORDER BY timestamp DESC LIMIT $1`
        : `SELECT * FROM images ORDER BY timestamp DESC LIMIT $1`;

      const result = await require('../storage/database').query(query, [limit]);

      res.json({
        success: true,
        total: result.rows.length,
        data: result.rows,
        lastUpdate: new Date()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch screenshots'
      });
    }
  });

  // Executive Dashboard - Analytics
  router.get('/dashboard/executive', async (req, res) => {
    const days = parseInt(req.query.days as string) || 30;

    try {
      const db = require('../storage/database');

      const alertsByPriority = await db.query(
        `SELECT priority, COUNT(*) as count 
         FROM alerts 
         WHERE timestamp > NOW() - INTERVAL '${days} days'
         GROUP BY priority`
      );

      const alertsByType = await db.query(
        `SELECT alert_type, COUNT(*) as count 
         FROM alerts 
         WHERE timestamp > NOW() - INTERVAL '${days} days'
         GROUP BY alert_type
         ORDER BY count DESC
         LIMIT 10`
      );

      const avgResponseTime = await db.query(
        `SELECT AVG(EXTRACT(EPOCH FROM (acknowledged_at - timestamp))) as avg_seconds
         FROM alerts 
         WHERE acknowledged_at IS NOT NULL
         AND timestamp > NOW() - INTERVAL '${days} days'`
      );

      const escalationRate = await db.query(
        `SELECT 
           COUNT(CASE WHEN escalation_level > 0 THEN 1 END)::FLOAT / NULLIF(COUNT(*), 0) * 100 as rate
         FROM alerts
         WHERE timestamp > NOW() - INTERVAL '${days} days'`
      );

      const resolutionRate = await db.query(
        `SELECT 
           COUNT(CASE WHEN status = 'resolved' THEN 1 END)::FLOAT / NULLIF(COUNT(*), 0) * 100 as rate
         FROM alerts
         WHERE timestamp > NOW() - INTERVAL '${days} days'`
      );

      res.json({
        success: true,
        period: `Last ${days} days`,
        data: {
          alertsByPriority: alertsByPriority.rows,
          alertsByType: alertsByType.rows,
          avgResponseTimeSeconds: parseFloat(avgResponseTime.rows[0]?.avg_seconds || 0).toFixed(2),
          escalationRate: parseFloat(escalationRate.rows[0]?.rate || 0).toFixed(2) + '%',
          resolutionRate: parseFloat(resolutionRate.rows[0]?.rate || 0).toFixed(2) + '%'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch dashboard data'
      });
    }
  });

  // Record speeding event
  router.post('/speeding/record', async (req, res) => {
    const { vehicleId, driverId, speed, speedLimit, latitude, longitude } = req.body;

    if (!vehicleId || !speed || !speedLimit) {
      return res.status(400).json({
        success: false,
        message: 'vehicleId, speed, and speedLimit are required'
      });
    }

    try {
      const eventId = await speedingManager.recordSpeedingEvent(
        vehicleId,
        driverId || null,
        speed,
        speedLimit,
        { latitude: latitude || 0, longitude: longitude || 0 }
      );

      res.json({
        success: true,
        eventId,
        message: 'Speeding event recorded'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to record speeding event'
      });
    }
  });

  // Get driver rating
  router.get('/drivers/:driverId/rating', async (req, res) => {
    const { driverId } = req.params;

    try {
      const result = await require('../storage/database').query(
        `SELECT * FROM drivers WHERE driver_id = $1`,
        [driverId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Driver not found'
        });
      }

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch driver rating'
      });
    }
  });

  // Get speeding events for driver
  router.get('/drivers/:driverId/speeding-events', async (req, res) => {
    const { driverId } = req.params;
    const days = parseInt(req.query.days as string) || 7;

    try {
      const result = await require('../storage/database').query(
        `SELECT * FROM speeding_events 
         WHERE driver_id = $1 AND timestamp > NOW() - INTERVAL '${days} days'
         ORDER BY timestamp DESC`,
        [driverId]
      );

      res.json({
        success: true,
        period: `Last ${days} days`,
        total: result.rows.length,
        data: result.rows
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch speeding events'
      });
    }
  });

  return router;
}