-- Simplified Schema - Focused on Retrieval Patterns
-- Everything links via device_id

-- ============================================
-- DEVICES
-- ============================================
CREATE TABLE devices (
  device_id TEXT PRIMARY KEY,
  ip_address TEXT,
  last_seen TIMESTAMPTZ
);

-- ============================================
-- VIDEOS (All recordings - live + alert clips)
-- ============================================
CREATE TABLE videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL REFERENCES devices(device_id),
  channel INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration_seconds INTEGER,
  video_type TEXT NOT NULL, -- 'live', 'alert_pre', 'alert_post'
  alert_id TEXT, -- NULL for live videos, set for alert clips
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ALERTS
-- ============================================
CREATE TABLE alerts (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES devices(device_id),
  channel INTEGER NOT NULL,
  alert_type TEXT NOT NULL,
  priority TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  escalation_level INTEGER DEFAULT 0,
  timestamp TIMESTAMPTZ NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- IMAGES
-- ============================================
CREATE TABLE images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL REFERENCES devices(device_id),
  channel INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_videos_device_time ON videos(device_id, start_time DESC);
CREATE INDEX idx_videos_alert ON videos(alert_id) WHERE alert_id IS NOT NULL;
CREATE INDEX idx_alerts_device_time ON alerts(device_id, timestamp DESC);
CREATE INDEX idx_alerts_status ON alerts(status) WHERE status != 'resolved';
CREATE INDEX idx_images_device_time ON images(device_id, timestamp DESC);

-- ============================================
-- KEY QUERIES
-- ============================================

-- Get all videos for device (live + alerts)
-- SELECT * FROM videos WHERE device_id = '123456789012' ORDER BY start_time DESC;

-- Get alert with its videos
-- SELECT a.*, 
--   (SELECT file_path FROM videos WHERE alert_id = a.id AND video_type = 'alert_pre') as pre_video,
--   (SELECT file_path FROM videos WHERE alert_id = a.id AND video_type = 'alert_post') as post_video
-- FROM alerts a WHERE a.id = 'ALT-xxx';

-- Get all alerts for device
-- SELECT * FROM alerts WHERE device_id = '123456789012' ORDER BY timestamp DESC;

-- Get active alerts
-- SELECT * FROM alerts WHERE status IN ('new', 'escalated') ORDER BY timestamp DESC;
