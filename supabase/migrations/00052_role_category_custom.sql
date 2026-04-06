-- Fix: add 'recruiter' to user_role_type enum (was missing since migration 00045)
ALTER TYPE user_role_type ADD VALUE IF NOT EXISTS 'recruiter';

-- Add role_category_custom for free-text role when candidate selects "Other"
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS role_category_custom text;

-- Update auto-assignment: candidates with role_category = 'Other' keep assigned_recruiter null.
-- This is enforced at the application layer (API insert logic), not via trigger,
-- because the existing assignment flow already checks role_category before matching.
-- The assignment_pending_review flag (migration 00047) already surfaces these in the unrouted queue.

COMMENT ON COLUMN candidates.role_category_custom IS 'Free-text role value when candidate selects Other as role_category. Used by recruiting_manager to decide assignment.';
