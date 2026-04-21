-- ============================================================
-- Migration 00083 — Demote pending_2nd_interview ghosts to active
-- ============================================================
--
-- Purpose
--   One-time remediation. Demotes the cohort of candidates who are
--   currently sitting in admin_status='pending_2nd_interview' without
--   any underlying evidence of a passed AI interview. These rows
--   accumulated as residue of two operator-runnable scripts
--   (scripts/migrate-remove-speaking-review.mjs and
--    scripts/apply-migration-079.ts) which promoted candidates from
--   the legacy 'pending_speaking_review' state without checking
--   whether an ai_interviews row existed. The recruiter dashboard on
--   interview.staffva.com inner-joins ai_interviews and so silently
--   omitted these rows, producing the "empty list" complaint that
--   surfaced this investigation.
--
-- Ghost definition
--   A candidate is a ghost iff:
--     candidates.admin_status = 'pending_2nd_interview'
--     AND NOT EXISTS (
--       SELECT 1 FROM ai_interviews ai
--       WHERE ai.candidate_id = candidates.id
--         AND ai.status = 'completed'
--         AND ai.overall_score >= 60
--     )
--
-- Invariant being enforced
--   No candidate may sit in admin_status='pending_2nd_interview'
--   without a corresponding ai_interviews row whose status='completed'
--   and overall_score>=60. This migration brings production into
--   compliance one-time; migration 00084 will install the DB-level
--   trigger that enforces the invariant going forward, so this
--   bucket cannot refill.
--
-- Companion changes already shipped
--   * Webhook commit c645063 (fix(webhook): preserve assigned_recruiter
--     on retake re-pass) — when any of the demoted candidates retake
--     and re-pass the AI interview, their original assigned_recruiter
--     value is preserved across the demote → retake → re-pass cycle.
--     Demotion in this migration deliberately leaves
--     candidates.assigned_recruiter intact.
--
-- Expected ghost count
--   97 as of preflight (Impact 1 diagnostic, 2026-04-20).
--   Tolerance band 92-102 — aborts if outside.
--
-- Safety
--   Transactional (BEGIN/COMMIT). Idempotent (audit table + admin_status
--   recheck on UPDATE). Preflight + post-write verification both raise
--   exceptions on anomaly so any failure rolls back cleanly.
-- ============================================================

BEGIN;

-- ──────────────────────────────────────────────────────────────
-- 1. Audit table — captures the ghost set before demotion
--    so post-hoc forensics and the upcoming candidate email
--    cohort have a durable record. PRIMARY KEY on candidate_id
--    gives us idempotency on re-runs.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.migration_00083_audit (
  candidate_id uuid PRIMARY KEY REFERENCES public.candidates(id),
  prior_admin_status admin_status_type NOT NULL,
  prior_assigned_recruiter uuid,
  demoted_at timestamptz NOT NULL DEFAULT now()
);

-- ──────────────────────────────────────────────────────────────
-- 2. Preflight — verify the ghost count is within the tolerance
--    band before any write happens. Aborts the transaction
--    cleanly if the data state has drifted unexpectedly.
-- ──────────────────────────────────────────────────────────────
DO $$
DECLARE
  ghost_count integer;
BEGIN
  SELECT COUNT(*) INTO ghost_count
  FROM public.candidates c
  WHERE c.admin_status = 'pending_2nd_interview'
  AND NOT EXISTS (
    SELECT 1 FROM public.ai_interviews ai
    WHERE ai.candidate_id = c.id
    AND ai.status = 'completed'
    AND ai.overall_score >= 60
  );

  IF ghost_count < 92 OR ghost_count > 102 THEN
    RAISE EXCEPTION 'Migration 00083 preflight abort: ghost count % outside expected band 92-102. Investigate before re-running.', ghost_count;
  END IF;

  RAISE NOTICE 'Migration 00083 preflight OK: ghost_count=%', ghost_count;
END $$;

-- ──────────────────────────────────────────────────────────────
-- 2b. Cast safety check — verify every ghost's assigned_recruiter
--     is a valid UUID-castable value before attempting the audit
--     insert. Raises a clean, readable exception if any row would
--     fail the cast, rather than failing mid-INSERT with a generic
--     type error.
-- ──────────────────────────────────────────────────────────────
DO $$
DECLARE
  bad_cast_count integer;
BEGIN
  SELECT COUNT(*) INTO bad_cast_count
  FROM public.candidates c
  WHERE c.admin_status = 'pending_2nd_interview'
  AND c.assigned_recruiter IS NOT NULL
  AND NOT (c.assigned_recruiter ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')
  AND NOT EXISTS (
    SELECT 1 FROM public.ai_interviews ai
    WHERE ai.candidate_id = c.id
    AND ai.status = 'completed'
    AND ai.overall_score >= 60
  );

  IF bad_cast_count > 0 THEN
    RAISE EXCEPTION 'Migration 00083 cast-safety abort: % ghost row(s) have non-UUID assigned_recruiter values. Investigate before re-running.', bad_cast_count;
  END IF;

  RAISE NOTICE 'Migration 00083 cast-safety OK: all ghost assigned_recruiter values are UUID-castable';
END $$;

-- ──────────────────────────────────────────────────────────────
-- 3. Audit insert — capture the ghost set BEFORE the UPDATE.
--    ON CONFLICT DO NOTHING preserves prior audit rows from any
--    earlier partial run, keeping the migration idempotent.
-- ──────────────────────────────────────────────────────────────
INSERT INTO public.migration_00083_audit (candidate_id, prior_admin_status, prior_assigned_recruiter)
SELECT c.id, c.admin_status, c.assigned_recruiter::uuid
FROM public.candidates c
WHERE c.admin_status = 'pending_2nd_interview'
AND NOT EXISTS (
  SELECT 1 FROM public.ai_interviews ai
  WHERE ai.candidate_id = c.id
  AND ai.status = 'completed'
  AND ai.overall_score >= 60
)
ON CONFLICT (candidate_id) DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- 4. Demote — drives off the audit table as source of truth.
--    The demoted_at>=now()-interval '1 minute' clause restricts
--    the UPDATE to rows logged in THIS transaction; the
--    admin_status='pending_2nd_interview' recheck makes a re-run
--    a no-op if a candidate retook and re-passed between runs.
--    assigned_recruiter is deliberately NOT touched — preserved
--    for recruiter continuity across the retake re-pass cycle.
-- ──────────────────────────────────────────────────────────────
UPDATE public.candidates c
SET admin_status = 'active',
    updated_at = now()
FROM public.migration_00083_audit a
WHERE c.id = a.candidate_id
AND a.demoted_at >= now() - interval '1 minute'
AND c.admin_status = 'pending_2nd_interview';

-- ──────────────────────────────────────────────────────────────
-- 5. Post-write verification — recount ghosts. Must be zero.
--    Any nonzero count means a row escaped the UPDATE and the
--    transaction must roll back so production is left untouched.
-- ──────────────────────────────────────────────────────────────
DO $$
DECLARE
  remaining_ghosts integer;
BEGIN
  SELECT COUNT(*) INTO remaining_ghosts
  FROM public.candidates c
  WHERE c.admin_status = 'pending_2nd_interview'
  AND NOT EXISTS (
    SELECT 1 FROM public.ai_interviews ai
    WHERE ai.candidate_id = c.id
    AND ai.status = 'completed'
    AND ai.overall_score >= 60
  );

  IF remaining_ghosts > 0 THEN
    RAISE EXCEPTION 'Migration 00083 post-write abort: % ghost(s) remain after UPDATE. Rolling back.', remaining_ghosts;
  END IF;

  RAISE NOTICE 'Migration 00083 post-write OK: 0 ghosts remain';
END $$;

COMMIT;
