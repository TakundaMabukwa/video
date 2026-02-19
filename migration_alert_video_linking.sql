-- Ensure DB supports alert-linked timeframe videos and URL storage.
-- Run this on the target PostgreSQL database.

BEGIN;

-- videos.storage_url is required for Supabase/public URL linkage.
ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS storage_url TEXT;

-- Allow new video types used by alert timeframe capture persistence.
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'videos'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%video_type%'
  LOOP
    EXECUTE format('ALTER TABLE videos DROP CONSTRAINT %I', c.conname);
  END LOOP;
END$$;

ALTER TABLE videos
  ADD CONSTRAINT videos_video_type_check
  CHECK (video_type IN ('live', 'alert_pre', 'alert_post', 'camera_sd', 'manual'));

-- Helpful for alert lookup.
CREATE INDEX IF NOT EXISTS idx_videos_alert_id ON videos(alert_id);

COMMIT;

