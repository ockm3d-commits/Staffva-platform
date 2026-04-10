-- 00066_remove_pending_speaking_review.sql
-- Remove 'pending_speaking_review' from admin_status_type enum.
-- Replace with 'pending_2nd_interview' and 'pending_review' based on candidate state.

-- 1. Add the two new enum values
ALTER TYPE admin_status_type ADD VALUE IF NOT EXISTS 'pending_2nd_interview';
ALTER TYPE admin_status_type ADD VALUE IF NOT EXISTS 'pending_review';

-- 2. Migrate any remaining pending_speaking_review candidates
--    Candidates with a completed second interview → pending_review
UPDATE candidates
SET admin_status = 'pending_review',
    updated_at = now()
WHERE admin_status = 'pending_speaking_review'
  AND second_interview_status = 'completed';

--    All others (none / scheduled) → pending_2nd_interview
UPDATE candidates
SET admin_status = 'pending_2nd_interview',
    updated_at = now()
WHERE admin_status = 'pending_speaking_review';

-- 3. Rebuild the enum without 'pending_speaking_review'
--    (a) Rename old enum
ALTER TYPE admin_status_type RENAME TO admin_status_type_old;

--    (b) Create new enum without the deprecated value
CREATE TYPE admin_status_type AS ENUM (
  'active',
  'pending_2nd_interview',
  'pending_review',
  'profile_review',
  'approved',
  'rejected'
);

--    (c) Swap the column to use the new enum
ALTER TABLE candidates
  ALTER COLUMN admin_status TYPE admin_status_type
  USING admin_status::text::admin_status_type;

--    (d) Restore the default
ALTER TABLE candidates
  ALTER COLUMN admin_status SET DEFAULT 'active';

--    (e) Drop the old enum
DROP TYPE admin_status_type_old;

-- 4. Verify zero records remain with the old status (this will fail loudly if any exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM candidates WHERE admin_status::text = 'pending_speaking_review'
  ) THEN
    RAISE EXCEPTION 'Migration failed: candidates still carry pending_speaking_review';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
