-- 00073_ai_interview_fail_gate.sql
-- Adds the 'ai_interview_failed' admin_status enum value and the
-- ai_interview_retake_notified_at column used by the retake notification cron.
--
-- Note: ALTER TYPE ... ADD VALUE cannot run inside a transaction block on
-- older Postgres. If your environment requires it, run statement 1 separately.

-- 1. Add new enum value for failed AI interview
ALTER TYPE admin_status_type ADD VALUE IF NOT EXISTS 'ai_interview_failed';

-- 2. Add notification timestamp column to candidates
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS ai_interview_retake_notified_at timestamptz;

-- 3. Reload PostgREST schema cache so the new enum value is visible to the API
NOTIFY pgrst, 'reload schema';
