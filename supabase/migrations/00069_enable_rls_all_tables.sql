-- ============================================================
-- Migration 00069: Enable RLS on all remaining tables
-- ============================================================
-- All API routes use the service_role key (bypasses RLS).
-- Client-side code uses the anon key (subject to RLS).
-- Tables that are only accessed server-side get RLS with no
-- policies — effectively locked to service role only.
-- Tables accessed client-side get scoped user policies.
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. Enable RLS on all tables that don't have it yet
--    (ALTER TABLE ... ENABLE ROW LEVEL SECURITY is idempotent)
-- ──────────────────────────────────────────────────────────────

-- Backend-only tables (service role access only, no anon policies)
ALTER TABLE webhook_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE trolley_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE giveaway_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE giveaway_winner_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE cheat_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE verified_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE english_test_lockouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE lockout_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_intro_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE manager_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE unrouted_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruiter_reassignment_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruiter_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_thread_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_packages ENABLE ROW LEVEL SECURITY;

-- Client-accessed tables (need user-scoped policies below)
ALTER TABLE screening_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_interviews ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────────────────────
-- 2. Policies for client-accessed tables
--    Pattern: candidate_id → candidates.user_id = auth.uid()
-- ──────────────────────────────────────────────────────────────

-- screening_queue: candidates INSERT their own row during application
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'candidates_insert_own_screening' AND tablename = 'screening_queue'
  ) THEN
    EXECUTE 'CREATE POLICY candidates_insert_own_screening ON screening_queue FOR INSERT TO authenticated WITH CHECK (
      EXISTS (SELECT 1 FROM candidates WHERE candidates.id = screening_queue.candidate_id AND candidates.user_id = auth.uid())
    )';
  END IF;
END $$;

-- application_progress: candidates manage their own test progress
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'candidates_select_own_progress' AND tablename = 'application_progress'
  ) THEN
    EXECUTE 'CREATE POLICY candidates_select_own_progress ON application_progress FOR SELECT TO authenticated USING (
      EXISTS (SELECT 1 FROM candidates WHERE candidates.id = application_progress.candidate_id AND candidates.user_id = auth.uid())
    )';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'candidates_insert_own_progress' AND tablename = 'application_progress'
  ) THEN
    EXECUTE 'CREATE POLICY candidates_insert_own_progress ON application_progress FOR INSERT TO authenticated WITH CHECK (
      EXISTS (SELECT 1 FROM candidates WHERE candidates.id = application_progress.candidate_id AND candidates.user_id = auth.uid())
    )';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'candidates_update_own_progress' AND tablename = 'application_progress'
  ) THEN
    EXECUTE 'CREATE POLICY candidates_update_own_progress ON application_progress FOR UPDATE TO authenticated USING (
      EXISTS (SELECT 1 FROM candidates WHERE candidates.id = application_progress.candidate_id AND candidates.user_id = auth.uid())
    )';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'candidates_delete_own_progress' AND tablename = 'application_progress'
  ) THEN
    EXECUTE 'CREATE POLICY candidates_delete_own_progress ON application_progress FOR DELETE TO authenticated USING (
      EXISTS (SELECT 1 FROM candidates WHERE candidates.id = application_progress.candidate_id AND candidates.user_id = auth.uid())
    )';
  END IF;
END $$;

-- engagement_offers: candidates read their own offers
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'candidates_select_own_offers' AND tablename = 'engagement_offers'
  ) THEN
    EXECUTE 'CREATE POLICY candidates_select_own_offers ON engagement_offers FOR SELECT TO authenticated USING (
      EXISTS (SELECT 1 FROM candidates WHERE candidates.id = engagement_offers.candidate_id AND candidates.user_id = auth.uid())
    )';
  END IF;
END $$;

-- candidate_change_requests: candidates read their own change requests
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'candidates_select_own_change_requests' AND tablename = 'candidate_change_requests'
  ) THEN
    EXECUTE 'CREATE POLICY candidates_select_own_change_requests ON candidate_change_requests FOR SELECT TO authenticated USING (
      EXISTS (SELECT 1 FROM candidates WHERE candidates.id = candidate_change_requests.candidate_id AND candidates.user_id = auth.uid())
    )';
  END IF;
END $$;

-- ai_interviews: candidates read their own interviews
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'candidates_select_own_ai_interviews' AND tablename = 'ai_interviews'
  ) THEN
    EXECUTE 'CREATE POLICY candidates_select_own_ai_interviews ON ai_interviews FOR SELECT TO authenticated USING (
      EXISTS (SELECT 1 FROM candidates WHERE candidates.id = ai_interviews.candidate_id AND candidates.user_id = auth.uid())
    )';
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────
-- 3. service_packages: public read access (browsable marketplace)
-- ──────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'public_read_service_packages' AND tablename = 'service_packages'
  ) THEN
    EXECUTE 'CREATE POLICY public_read_service_packages ON service_packages FOR SELECT USING (true)';
  END IF;
END $$;
