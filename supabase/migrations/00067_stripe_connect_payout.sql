-- ============================================================
-- 00067_stripe_connect_payout.sql
-- Stripe Connect Express payout integration
-- ============================================================

-- Candidates: Stripe Connect account fields
ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS stripe_account_id text,
  ADD COLUMN IF NOT EXISTS stripe_onboarding_complete boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_onboarding_url text,
  ADD COLUMN IF NOT EXISTS payout_status text NOT NULL DEFAULT 'not_setup'
    CHECK (payout_status IN ('not_setup', 'onboarding', 'active', 'suspended'));

-- payment_periods: payout tracking
ALTER TABLE payment_periods
  ADD COLUMN IF NOT EXISTS stripe_transfer_id text,
  ADD COLUMN IF NOT EXISTS payout_fired_at timestamptz,
  ADD COLUMN IF NOT EXISTS payout_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS payout_failed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payout_failure_reason text;

-- milestones: payout tracking (used for project-based escrow in release handler)
ALTER TABLE milestones
  ADD COLUMN IF NOT EXISTS stripe_transfer_id text,
  ADD COLUMN IF NOT EXISTS payout_fired_at timestamptz,
  ADD COLUMN IF NOT EXISTS payout_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS payout_failed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payout_failure_reason text;

-- service_orders: payout tracking
ALTER TABLE service_orders
  ADD COLUMN IF NOT EXISTS stripe_transfer_id text,
  ADD COLUMN IF NOT EXISTS payout_fired_at timestamptz,
  ADD COLUMN IF NOT EXISTS payout_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS payout_failed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payout_failure_reason text;

-- Indexes for fast lookup by Stripe IDs
CREATE INDEX IF NOT EXISTS idx_candidates_stripe_account_id
  ON candidates(stripe_account_id);

CREATE INDEX IF NOT EXISTS idx_payment_periods_stripe_transfer_id
  ON payment_periods(stripe_transfer_id);

CREATE INDEX IF NOT EXISTS idx_milestones_stripe_transfer_id
  ON milestones(stripe_transfer_id);

-- Index for the admin alert: approved candidates with no payout setup
CREATE INDEX IF NOT EXISTS idx_candidates_payout_status_approved
  ON candidates(payout_status, admin_status);
