-- Ban pending review columns on candidates
-- Used by recruiting_manager to flag a candidate for deactivation,
-- pending confirmation from admin (Ahmed).
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS ban_pending_review BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS ban_requested_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS ban_requested_at TIMESTAMPTZ;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS ban_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_candidates_ban_pending ON candidates(ban_pending_review) WHERE ban_pending_review = true;
