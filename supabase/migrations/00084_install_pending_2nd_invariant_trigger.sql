-- ============================================================
-- Migration 00084 — Install pending_2nd_interview invariant trigger
-- ============================================================
--
-- Purpose
--   Install a DB-level invariant that prevents any future write
--   from leaving a candidate in admin_status='pending_2nd_interview'
--   without a corresponding ai_interviews row whose status='completed'
--   and overall_score>=60. Locks in the cleanup performed by
--   migration 00083 so the ghost bucket cannot refill, regardless
--   of whether the offending writer is the AI-interview-complete
--   webhook, an admin route, an operator-runnable script, manual
--   SQL via Supabase Studio, or any future service.
--
-- Why a trigger and not a CHECK constraint
--   The rule spans two tables (candidates and ai_interviews).
--   PostgreSQL CHECK constraints can only see columns of the row
--   being validated — they cannot reference other tables. A
--   BEFORE INSERT OR UPDATE trigger is the correct enforcement
--   mechanism here.
--
-- Companion changes already shipped
--   * Migration 00083 — one-time demotion of the 97-row ghost
--     cohort that this trigger would otherwise reject on every
--     subsequent UPDATE.
--   * Webhook commit c645063 — preserves assigned_recruiter on
--     the retake re-pass cycle.
--
-- Violation audit trail
--   Rejected writes raise a detailed exception with candidate_id,
--   session_user, application_name, and timestamp embedded in the
--   message. Supabase's Postgres logs capture every exception
--   automatically, providing the audit trail without needing a
--   separate table (which cannot work reliably because exceptions
--   roll back any INSERT in the same transaction).
--
-- Performance
--   The trigger's WHEN clause fires only when NEW.admin_status =
--   'pending_2nd_interview', so writes to any other status pay
--   zero overhead.
-- ============================================================

BEGIN;

-- ──────────────────────────────────────────────────────────────
-- 1. Trigger function — enforces the invariant.
--    Returns NEW unchanged on the allowed paths; raises a
--    check_violation exception with detailed context on the
--    disallowed path.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_pending_2nd_invariant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  has_valid_interview boolean;
  v_session text;
  v_app text;
  v_op text;
  v_prior text;
BEGIN
  -- Only enforce when the new value is pending_2nd_interview
  IF NEW.admin_status IS DISTINCT FROM 'pending_2nd_interview' THEN
    RETURN NEW;
  END IF;

  -- On UPDATE, allow the no-op case where status was already pending_2nd
  IF TG_OP = 'UPDATE' AND OLD.admin_status = 'pending_2nd_interview' THEN
    RETURN NEW;
  END IF;

  -- Check for a completed+passed ai_interviews row
  SELECT EXISTS (
    SELECT 1 FROM public.ai_interviews ai
    WHERE ai.candidate_id = NEW.id
    AND ai.status = 'completed'
    AND ai.overall_score >= 60
  ) INTO has_valid_interview;

  IF has_valid_interview THEN
    RETURN NEW;
  END IF;

  -- Gather forensic context for the exception message
  v_session := session_user;
  v_app := coalesce(nullif(current_setting('application_name', true), ''), 'unknown');
  v_op := TG_OP;
  v_prior := CASE WHEN TG_OP = 'UPDATE' THEN OLD.admin_status::text ELSE 'NULL (insert)' END;

  RAISE EXCEPTION 'admin_status invariant violation: cannot set candidate % to pending_2nd_interview without a completed ai_interviews row (overall_score >= 60). Forensic context: op=%, prior_status=%, session_user=%, application_name=%. Check Supabase Postgres logs for full audit trail.',
    NEW.id, v_op, v_prior, v_session, v_app
    USING ERRCODE = 'check_violation';
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- 2. Trigger binding on public.candidates.
--    BEFORE INSERT OR UPDATE OF admin_status fires only when the
--    admin_status column is the target of the write. The WHEN
--    clause further narrows execution to writes where the new
--    value is pending_2nd_interview.
-- ──────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS enforce_pending_2nd_invariant_trg ON public.candidates;
CREATE TRIGGER enforce_pending_2nd_invariant_trg
  BEFORE INSERT OR UPDATE OF admin_status ON public.candidates
  FOR EACH ROW
  WHEN (NEW.admin_status = 'pending_2nd_interview')
  EXECUTE FUNCTION public.enforce_pending_2nd_invariant();

COMMENT ON TRIGGER enforce_pending_2nd_invariant_trg ON public.candidates IS
  'Enforces the invariant that admin_status=pending_2nd_interview requires a completed+passed ai_interviews row. Violations raise exception with forensic context; Supabase Postgres logs capture the audit trail.';

-- ──────────────────────────────────────────────────────────────
-- 3. Self-test — attempt a forbidden write against a real candidate
--    with no valid ai_interviews row. Expect the trigger to raise
--    check_violation. The nested block catches the exception and
--    NOTICEs success. No audit table INSERT needed — the exception
--    itself (captured by Supabase logs) is the audit trail.
-- ──────────────────────────────────────────────────────────────
DO $$
DECLARE
  test_candidate_id uuid;
BEGIN
  SELECT c.id INTO test_candidate_id
  FROM public.candidates c
  WHERE NOT EXISTS (
    SELECT 1 FROM public.ai_interviews ai
    WHERE ai.candidate_id = c.id
    AND ai.status = 'completed'
    AND ai.overall_score >= 60
  )
  AND c.admin_status != 'pending_2nd_interview'
  LIMIT 1;

  IF test_candidate_id IS NULL THEN
    RAISE NOTICE 'Self-test skipped: no candidate available without valid ai_interviews row';
    RETURN;
  END IF;

  BEGIN
    UPDATE public.candidates SET admin_status = 'pending_2nd_interview' WHERE id = test_candidate_id;
    RAISE EXCEPTION 'Self-test FAILED: trigger did not block the forbidden write for candidate %', test_candidate_id;
  EXCEPTION
    WHEN check_violation THEN
      -- Trigger fired as expected.
      NULL;
  END;

  RAISE NOTICE 'Self-test PASSED: trigger blocked forbidden write for candidate %', test_candidate_id;
END $$;

COMMIT;
