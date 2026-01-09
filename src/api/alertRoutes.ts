import express from 'express';

export function createAlertRoutes(): express.Router {
  const router = express.Router();

  // Get all alerts with filtering
  router.get('/', async (req, res) => {
    try {
      const { priority, status, device_id, limit = 100 } = req.query;
      
      let query = 'SELECT * FROM alerts WHERE 1=1';
      const params: any[] = [];
      let paramCount = 1;
      
      if (priority) {
        query += ` AND priority = $${paramCount++}`;
        params.push(priority);
      }
      if (status) {
        query += ` AND status = $${paramCount++}`;
        params.push(status);
      }
      if (device_id) {
        query += ` AND device_id = $${paramCount++}`;
        params.push(device_id);
      }
      
      query += ` ORDER BY timestamp DESC LIMIT $${paramCount}`;
      params.push(limit);
      
      const result = await require('../storage/database').query(query, params);
      
      res.json({
        success: true,
        total: result.rows.length,
        data: result.rows
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch alerts' });
    }
  });

  // Get alerts grouped by priority
  router.get('/by-priority', async (req, res) => {
    try {
      const result = await require('../storage/database').query(
        `SELECT priority, COUNT(*) as count, 
                json_agg(json_build_object(
                  'id', id,
                  'device_id', device_id,
                  'alert_type', alert_type,
                  'status', status,
                  'timestamp', timestamp
                ) ORDER BY timestamp DESC) as alerts
         FROM alerts
         WHERE status != 'resolved'
         GROUP BY priority
         ORDER BY 
           CASE priority
             WHEN 'critical' THEN 1
             WHEN 'high' THEN 2
             WHEN 'medium' THEN 3
             WHEN 'low' THEN 4
           END`
      );
      
      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch alerts by priority' });
    }
  });

  // Get alert history
  router.get('/history', async (req, res) => {
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
      
      res.json({
        success: true,
        total: result.rows.length,
        data: result.rows
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch alert history' });
    }
  });

  // Get unresolved alerts (for reminders)
  router.get('/unresolved', async (req, res) => {
    try {
      const result = await require('../storage/database').query(
        `SELECT a.*, 
                EXTRACT(EPOCH FROM (NOW() - a.timestamp))/60 as minutes_open,
                (SELECT COUNT(*) FROM images WHERE alert_id = a.id) as screenshot_count
         FROM alerts a
         WHERE status IN ('new', 'acknowledged', 'escalated')
         ORDER BY 
           CASE priority
             WHEN 'critical' THEN 1
             WHEN 'high' THEN 2
             WHEN 'medium' THEN 3
             WHEN 'low' THEN 4
           END,
           timestamp DESC`
      );
      
      res.json({
        success: true,
        total: result.rows.length,
        data: result.rows
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch unresolved alerts' });
    }
  });

  // Get driver behavior alerts
  router.get('/driver-behavior', async (req, res) => {
    try {
      const result = await require('../storage/database').query(
        `SELECT * FROM alerts 
         WHERE alert_type IN ('Driver Fatigue', 'Phone Call While Driving', 'Smoking While Driving')
         ORDER BY timestamp DESC
         LIMIT 100`
      );
      
      res.json({
        success: true,
        total: result.rows.length,
        data: result.rows
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch driver behavior alerts' });
    }
  });

  // Get alerts by device
  router.get('/by-device', async (req, res) => {
    try {
      const result = await require('../storage/database').query(
        `SELECT device_id, COUNT(*) as total_alerts,
                COUNT(*) FILTER (WHERE status = 'new') as new_alerts,
                COUNT(*) FILTER (WHERE status = 'acknowledged') as acknowledged_alerts,
                COUNT(*) FILTER (WHERE status = 'escalated') as escalated_alerts,
                COUNT(*) FILTER (WHERE priority = 'critical') as critical_alerts,
                COUNT(*) FILTER (WHERE priority = 'high') as high_alerts,
                MAX(timestamp) as last_alert_time,
                json_agg(json_build_object(
                  'id', id,
                  'alert_type', alert_type,
                  'priority', priority,
                  'status', status,
                  'timestamp', timestamp
                ) ORDER BY timestamp DESC) as recent_alerts
         FROM alerts
         GROUP BY device_id
         ORDER BY MAX(timestamp) DESC`
      );
      
      res.json({
        success: true,
        total: result.rows.length,
        data: result.rows
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch alerts by device' });
    }
  });

  // Get alert by ID
  router.get('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const result = await require('../storage/database').query(
        'SELECT * FROM alerts WHERE id = $1',
        [id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Alert not found' });
      }
      
      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch alert' });
    }
  });

  // Get alert with screenshots and videos
  router.get('/:id/media', async (req, res) => {
    try {
      const { id } = req.params;
      
      const [alert, images, videos] = await Promise.all([
        require('../storage/database').query('SELECT * FROM alerts WHERE id = $1', [id]),
        require('../storage/database').query(
          'SELECT * FROM images WHERE alert_id = $1 ORDER BY timestamp',
          [id]
        ),
        require('../storage/database').query(
          'SELECT * FROM videos WHERE alert_id = $1 ORDER BY video_type',
          [id]
        )
      ]);
      
      if (alert.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Alert not found' });
      }
      
      res.json({
        success: true,
        data: {
          alert: alert.rows[0],
          screenshots: images.rows,
          videos: videos.rows
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch alert media' });
    }
  });

  // Acknowledge alert
  router.post('/:id/acknowledge', async (req, res) => {
    try {
      const { id } = req.params;
      await require('../storage/database').query(
        'UPDATE alerts SET status = $1, acknowledged_at = NOW() WHERE id = $2',
        ['acknowledged', id]
      );
      
      res.json({
        success: true,
        message: `Alert ${id} acknowledged`
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to acknowledge alert' });
    }
  });

  // Resolve alert
  router.post('/:id/resolve', async (req, res) => {
    try {
      const { id } = req.params;
      await require('../storage/database').query(
        'UPDATE alerts SET status = $1, resolved_at = NOW() WHERE id = $2',
        ['resolved', id]
      );
      
      res.json({
        success: true,
        message: `Alert ${id} resolved`
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to resolve alert' });
    }
  });

  // Get all screenshots (auto-refresh endpoint)
  router.get('/screenshots/all', async (req, res) => {
    try {
      const { limit = 50, alert_only = false } = req.query;
      
      let query = 'SELECT * FROM images';
      if (alert_only === 'true') {
        query += ' WHERE alert_id IS NOT NULL';
      }
      query += ' ORDER BY timestamp DESC LIMIT $1';
      
      const result = await require('../storage/database').query(query, [limit]);
      
      res.json({
        success: true,
        total: result.rows.length,
        data: result.rows
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch screenshots' });
    }
  });

  return router;
}
