-- Add ai_interview_completed_at column to candidates table
-- This field is set by the AI interview platform webhook when a candidate completes their interview
-- Used by the progress tracker to determine Step 5 completion
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS ai_interview_completed_at TIMESTAMPTZ;

-- Backfill from ai_interviews table for candidates who already completed
UPDATE candidates c
SET ai_interview_completed_at = ai.completed_at
FROM ai_interviews ai
WHERE ai.candidate_id = c.id
  AND ai.status = 'completed'
  AND ai.completed_at IS NOT NULL
  AND c.ai_interview_completed_at IS NULL;
