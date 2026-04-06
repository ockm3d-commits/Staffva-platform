-- 00058_active_status_flow_fix.sql
-- Add 'active' as the neutral in-pipeline status for candidates post-AI-interview.
-- Replaces incorrect use of 'pending_speaking_review' as auto-assigned status.

-- 1. Add 'active' to admin_status_type enum
ALTER TYPE admin_status_type ADD VALUE IF NOT EXISTS 'active';

-- 2. Move candidates who are still pre-second-interview from pending_speaking_review to active
UPDATE candidates
SET admin_status = 'active'
WHERE admin_status = 'pending_speaking_review'
  AND second_interview_status IN ('none', 'scheduled');

-- 3. Change the column default from 'pending_speaking_review' to 'active'
ALTER TABLE candidates ALTER COLUMN admin_status SET DEFAULT 'active';
