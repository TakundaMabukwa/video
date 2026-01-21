-- Alert Management System Database Updates

-- 1. Add missing fields to alerts table
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS speed DECIMAL(5,2);
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS direction INTEGER;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS altitude INTEGER;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS fatigue_level INTEGER;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS resolution_notes TEXT;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS resolved_by TEXT;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS resolution_timestamp TIMESTAMPTZ;

-- 2. Create speeding events table
CREATE TABLE IF NOT EXISTS speeding_events (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL,
  driver_id TEXT,
  timestamp TIMESTAMPTZ NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  speed DECIMAL(5, 2) NOT NULL,
  speed_limit DECIMAL(5, 2) NOT NULL,
  excess_speed DECIMAL(5, 2) NOT NULL,
  duration INTEGER DEFAULT 0,
  severity TEXT CHECK (severity IN ('minor', 'moderate', 'severe')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create drivers table for rating system
CREATE TABLE IF NOT EXISTS drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  license_number TEXT,
  current_rating INTEGER DEFAULT 100 CHECK (current_rating >= 0 AND current_rating <= 100),
  total_demerits INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create alert actions audit table
CREATE TABLE IF NOT EXISTS alert_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('acknowledged', 'escalated', 'resolved', 'note_added')),
  action_by TEXT NOT NULL,
  action_timestamp TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  metadata JSONB
);

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_alerts_vehicle_timestamp ON alerts(vehicle_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_priority ON alerts(priority);
CREATE INDEX IF NOT EXISTS idx_speeding_events_vehicle ON speeding_events(vehicle_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_speeding_events_severity ON speeding_events(severity);
CREATE INDEX IF NOT EXISTS idx_alert_actions_alert_id ON alert_actions(alert_id);