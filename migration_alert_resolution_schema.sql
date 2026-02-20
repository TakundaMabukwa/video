-- Alert closure schema extension:
-- - resolved boolean (default false)
-- - NCR document link fields
-- - false-alert reason code
-- - closure type marker

BEGIN;

ALTER TABLE alerts
  ADD COLUMN IF NOT EXISTS resolved BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE alerts
  ADD COLUMN IF NOT EXISTS closure_type TEXT;

ALTER TABLE alerts
  ADD COLUMN IF NOT EXISTS ncr_document_url TEXT;

ALTER TABLE alerts
  ADD COLUMN IF NOT EXISTS ncr_document_name TEXT;

ALTER TABLE alerts
  ADD COLUMN IF NOT EXISTS is_false_alert BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE alerts
  ADD COLUMN IF NOT EXISTS false_alert_reason TEXT;

ALTER TABLE alerts
  ADD COLUMN IF NOT EXISTS false_alert_reason_code TEXT;

-- Backfill resolved boolean from status for existing rows.
UPDATE alerts
SET resolved = CASE WHEN status = 'resolved' THEN TRUE ELSE FALSE END
WHERE resolved IS DISTINCT FROM (status = 'resolved');

-- Keep closure type constrained but flexible for current workflow.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'alerts_closure_type_check'
      AND conrelid = 'alerts'::regclass
  ) THEN
    ALTER TABLE alerts
      ADD CONSTRAINT alerts_closure_type_check
      CHECK (
        closure_type IS NULL OR
        closure_type IN ('ncr', 'false_alert', 'manual', 'other')
      );
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_alerts_resolved_bool ON alerts(resolved);
CREATE INDEX IF NOT EXISTS idx_alerts_closure_type ON alerts(closure_type);

COMMIT;

