-- ============================================================
-- Migration 00071: Calendar link monitoring for talent specialists
-- ============================================================
-- Adds tracking columns to profiles and a new alerts table
-- so admins know when a recruiter removes their calendar link.
-- ============================================================

-- 1. Add tracking columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS calendar_link_last_set_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS calendar_link_cleared_at TIMESTAMPTZ;

-- 2. Create calendar_link_alerts table
CREATE TABLE IF NOT EXISTS calendar_link_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id UUID NOT NULL REFERENCES profiles(id),
  recruiter_name TEXT NOT NULL,
  alerted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  acknowledged_at TIMESTAMPTZ
);

-- 3. Enable RLS (service-role only — no anon policies needed)
ALTER TABLE calendar_link_alerts ENABLE ROW LEVEL SECURITY;
