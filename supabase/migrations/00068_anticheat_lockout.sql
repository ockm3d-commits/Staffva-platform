-- ============================================================
-- 00068_anticheat_lockout.sql
-- Anti-cheat lockout system: return tracking + post-ID lockout
-- ============================================================

-- Enum for lockout reason
DO $$ BEGIN
  CREATE TYPE anticheat_lockout_reason_type AS ENUM ('four_strikes', 'ten_second_absence');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- test_events: track when candidate returned after a leave event
ALTER TABLE test_events
  ADD COLUMN IF NOT EXISTS returned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS absence_duration_seconds INTEGER;

-- candidates: anti-cheat tracking and lockout fields
ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS anticheat_strike_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS anticheat_max_absence_seconds INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS anticheat_lockout_triggered BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS anticheat_lockout_reason anticheat_lockout_reason_type,
  ADD COLUMN IF NOT EXISTS test_lockout_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS test_lockout_notified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS identity_session_id TEXT;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_candidates_test_lockout_until
  ON candidates(test_lockout_until)
  WHERE test_lockout_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_candidates_anticheat_lockout
  ON candidates(anticheat_lockout_triggered)
  WHERE anticheat_lockout_triggered = true;

CREATE INDEX IF NOT EXISTS idx_test_events_candidate_leave_types
  ON test_events(candidate_id, event_type);
