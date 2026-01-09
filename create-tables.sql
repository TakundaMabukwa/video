-- JT/T 1078 Video System - PostgreSQL Schema
-- Database: video_data
-- Run this on your droplet PostgreSQL

-- 1. DEVICES TABLE
CREATE TABLE IF NOT EXISTS devices (
  device_id TEXT PRIMARY KEY,
  ip_address TEXT,
  last_seen TIMESTAMPTZ DEFAULT NOW()
);

-- 2. VIDEOS TABLE (All recordings: live + alert clips)
CREATE TABLE IF NOT EXISTS videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
  channel INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration_seconds INTEGER,
  video_type TEXT NOT NULL CHECK (video_type IN ('live', 'alert_pre', 'alert_post')),
  alert_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ALERTS TABLE
CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
  channel INTEGER NOT NULL,
  alert_type TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'acknowledged', 'escalated', 'resolved')),
  escalation_level INTEGER DEFAULT 0,
  timestamp TIMESTAMPTZ NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. IMAGES TABLE
CREATE TABLE IF NOT EXISTS images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
  channel INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_videos_device_time ON videos(device_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_videos_alert ON videos(alert_id) WHERE alert_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_alerts_device_time ON alerts(device_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status) WHERE status != 'resolved';
CREATE INDEX IF NOT EXISTS idx_images_device_time ON images(device_id, timestamp DESC);
