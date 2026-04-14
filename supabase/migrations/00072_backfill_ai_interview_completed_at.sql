-- Backfill ai_interview_completed_at and advance admin_status for candidates
-- whose latest passed ai_interviews row was never written back to the candidates table.
-- Fixes candidates stuck on "Start AI Interview" after the external interview platform
-- marked their interview as passed but the webhook did not update the candidates row.

UPDATE candidates c
SET
  ai_interview_completed_at = ai.completed_at,
  admin_status = 'pending_2nd_interview'
FROM (
  SELECT DISTINCT ON (candidate_id)
    candidate_id, completed_at, passed
  FROM ai_interviews
  WHERE passed = true
  ORDER BY candidate_id, created_at DESC
) ai
WHERE c.id = ai.candidate_id
  AND c.ai_interview_completed_at IS NULL
  AND c.admin_status NOT IN ('approved', 'rejected');
