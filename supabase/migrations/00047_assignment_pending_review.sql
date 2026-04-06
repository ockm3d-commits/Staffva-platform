-- Add assignment_pending_review flag to candidates table
-- Used to hold "Other" role candidates pending Manar's manual routing
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS assignment_pending_review boolean NOT NULL DEFAULT false;
