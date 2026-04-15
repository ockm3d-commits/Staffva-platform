-- ============================================================
-- Migration 00075: cleanup recruiter name-string orphans
-- ============================================================
-- Repairs candidates.assigned_recruiter values that were written as
-- the literal first-name strings 'Jerome' or 'Shelly' by legacy
-- round-robin code paths (pre-Step-A fix):
--   - src/app/api/cron/process-application-queue/route.ts
--   - src/app/api/notifications/slack-new-candidate/route.ts
--
-- Both writers have been replaced (Step A) with a proper
-- role_category -> recruiter_assignments.recruiter_id UUID lookup,
-- matching the behavior already used by the AI-interview-complete
-- webhook. This migration reconciles the 25 historical orphan rows
-- identified by the audit (scripts/audit-orphan-routing.ts) so that
-- every candidate row's assigned_recruiter is a valid UUID.
--
-- Per scope v6.6: recruiter assignment is UUID-based via
-- recruiter_assignments (role_category -> recruiter profile UUID).
-- Name strings are a legacy artifact.
--
-- Cleanup policy (Option A, approved after Step B audit): we only
-- touch rows whose current assigned_recruiter is literally 'Jerome'
-- or 'Shelly'. UUID-assigned rows are OUT OF SCOPE for this migration
-- even if the UUID disagrees with recruiter_assignments.
--
-- Expected output when applied to production:
--   NOTICE:  recruiter-name orphan cleanup (primary):   25 rows re-routed via recruiter_assignments
--   NOTICE:  recruiter-name orphan cleanup (fallback):   0 rows assigned to Manar (pending_review = true)
--   NOTICE:  remaining non-UUID assigned_recruiter rows: 0
--
-- Idempotent: re-running the migration after success affects 0 rows
-- and emits zeroes for all three notices. Data-only; no schema changes.
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. Primary cleanup — role_category -> recruiter_assignments lookup
--    Target: assigned_recruiter IN ('Jerome', 'Shelly') AND the row's
--    role_category has a routing row in recruiter_assignments.
--    Writes: assigned_recruiter = recruiter_assignments.recruiter_id,
--            assignment_pending_review = false.
-- ──────────────────────────────────────────────────────────────
DO $$
DECLARE
  rerouted_count integer;
BEGIN
  WITH updated AS (
    UPDATE candidates c
       SET assigned_recruiter = ra.recruiter_id,
           assignment_pending_review = false
      FROM recruiter_assignments ra
     WHERE c.assigned_recruiter IN ('Jerome', 'Shelly')
       AND c.role_category = ra.role_category
    RETURNING 1
  )
  SELECT COUNT(*) INTO rerouted_count FROM updated;

  RAISE NOTICE 'recruiter-name orphan cleanup (primary):   % rows re-routed via recruiter_assignments', rerouted_count;
END $$;

-- ──────────────────────────────────────────────────────────────
-- 2. Defensive fallback — catches any name-string orphan whose
--    role_category did NOT match a recruiter_assignments row
--    (should never fire per the Step B audit, but safe in case the
--    routing table changes between audit time and migration time).
--    Writes: assigned_recruiter = Manar's UUID,
--            assignment_pending_review = true so it surfaces in the
--            admin "Needs Routing" queue.
-- ──────────────────────────────────────────────────────────────
DO $$
DECLARE
  fallback_count integer;
BEGIN
  WITH updated AS (
    UPDATE candidates
       SET assigned_recruiter = '73da7f50-b637-4b8d-a38e-7ae36e2acfd5',
           assignment_pending_review = true
     WHERE assigned_recruiter IN ('Jerome', 'Shelly')
    RETURNING 1
  )
  SELECT COUNT(*) INTO fallback_count FROM updated;

  RAISE NOTICE 'recruiter-name orphan cleanup (fallback):   % rows assigned to Manar (pending_review = true)', fallback_count;
END $$;

-- ──────────────────────────────────────────────────────────────
-- 3. Final verification — count rows whose assigned_recruiter is
--    still NOT a valid UUID format. This should be 0 after the two
--    blocks above. If it is not 0, an unknown name-string value
--    exists (outside 'Jerome'/'Shelly') and warrants investigation
--    before code that expects UUID-only values is relied upon.
-- ──────────────────────────────────────────────────────────────
DO $$
DECLARE
  remaining_count integer;
BEGIN
  SELECT COUNT(*) INTO remaining_count
    FROM candidates
   WHERE assigned_recruiter IS NOT NULL
     AND assigned_recruiter !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

  RAISE NOTICE 'remaining non-UUID assigned_recruiter rows: %', remaining_count;
END $$;

-- 4. Reload PostgREST schema cache (consistent with prior migrations)
NOTIFY pgrst, 'reload schema';
