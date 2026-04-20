-- ============================================================
-- Migration 00082: Harden Google Calendar match logic
-- ============================================================
-- Schema prerequisites for src/lib/google-calendar.ts hardening:
--
--   3a. calendar_unmatched_bookings
--       + attendee_email  (so we can store the email that the
--                          webhook evaluated for Safeguard A)
--       + unmatch_reason  (which of the 5 safeguards rejected)
--       + UNIQUE (recruiter_id, event_id) so upsert-on-conflict
--                          eliminates the "Team Morning Huddle"
--                          style 16x-duplication seen in prod
--                          (4,000 of 4,003 rows are one event)
--
--   3b. candidates
--       + assigned_recruiter_at  (floor for Safeguard B —
--                          "event cannot predate assignment").
--                          Backfilled from ai_interview_completed_at
--                          for candidates who are currently assigned.
--
-- Every statement is idempotent. The dedup DELETE runs before the
-- UNIQUE constraint is added; if the constraint already exists the
-- DO block skips creation (so the DELETE also becomes a no-op on
-- a clean run).
-- ============================================================

-- ─── 3a.1: add columns to calendar_unmatched_bookings ──────────────
ALTER TABLE calendar_unmatched_bookings
  ADD COLUMN IF NOT EXISTS attendee_email text,
  ADD COLUMN IF NOT EXISTS unmatch_reason text;

-- ─── 3a.2: one-time dedup of existing duplicate rows ────────────────
-- Keeps the lowest id per (recruiter_id, event_id). Safe to re-run:
-- when no duplicates exist, the DELETE affects zero rows.
DELETE FROM calendar_unmatched_bookings a
USING calendar_unmatched_bookings b
WHERE a.id > b.id
  AND a.recruiter_id = b.recruiter_id
  AND a.event_id = b.event_id;

-- ─── 3a.3: add unique constraint (guard with DO block for idempotency) ──
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'unmatched_bookings_unique_per_recruiter'
      AND conrelid = 'public.calendar_unmatched_bookings'::regclass
  ) THEN
    ALTER TABLE calendar_unmatched_bookings
      ADD CONSTRAINT unmatched_bookings_unique_per_recruiter
      UNIQUE (recruiter_id, event_id);
  END IF;
END $$;

-- ─── 3b.1: add assigned_recruiter_at to candidates ──────────────────
ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS assigned_recruiter_at timestamptz;

-- ─── 3b.2: backfill from ai_interview_completed_at ──────────────────
-- Scope: only rows that already have an assigned_recruiter but no
-- assigned_recruiter_at. ai_interview_completed_at is the authoritative
-- assignment time per Scope v6.6 Section 11E (assignment happens at AI
-- interview completion on pass). Re-runs are safe because the predicate
-- `assigned_recruiter_at IS NULL` filters out already-backfilled rows.
UPDATE candidates
SET assigned_recruiter_at = ai_interview_completed_at
WHERE assigned_recruiter IS NOT NULL
  AND assigned_recruiter_at IS NULL
  AND ai_interview_completed_at IS NOT NULL;

NOTIFY pgrst, 'reload schema';
