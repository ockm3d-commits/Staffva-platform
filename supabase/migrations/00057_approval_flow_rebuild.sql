-- 00057_approval_flow_rebuild.sql
-- Rebuild candidate approval flow: recruiter direct approval, manager notifications

-- 1. Add 'profile_review' to admin_status_type enum
ALTER TYPE admin_status_type ADD VALUE IF NOT EXISTS 'profile_review';

-- 2. Migrate existing pending_speaking_review candidates to profile_review
UPDATE candidates
SET admin_status = 'profile_review'
WHERE admin_status = 'pending_speaking_review';

-- 3. Create manager_notifications table
CREATE TABLE IF NOT EXISTS manager_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  candidate_id UUID REFERENCES candidates(id) ON DELETE SET NULL,
  recruiter_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_manager_notifications_manager
  ON manager_notifications(manager_id);
CREATE INDEX IF NOT EXISTS idx_manager_notifications_unread
  ON manager_notifications(manager_id) WHERE read_at IS NULL;

-- 4. Create unrouted_alerts table
CREATE TABLE IF NOT EXISTS unrouted_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  ai_interview_result BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_unrouted_alerts_unresolved
  ON unrouted_alerts(candidate_id) WHERE resolved_at IS NULL;
