-- ═══════════════════════════════════════════════════════════════════════════
-- 00079_remove_speaking_level_and_consolidate_statuses.sql
-- Branch: remove-speaking-level
--
-- Removes the deprecated speaking-level scoring system (columns, enum, RPC
-- param) and the orphaned spoken_english scoring columns. Consolidates the
-- admin_status enum to the 6 values the application actually uses, migrating
-- legacy 'pending_speaking_review' rows into states consistent with their
-- ai_interview_score.
--
-- Scope:
--   1–4  Drop deprecated columns (speaking_level_updated_to, speaking_level,
--        spoken_english_score, spoken_english_result)
--   5    Drop speaking_level_type enum (now unreferenced)
--   6–8  Migrate 110 'pending_speaking_review' + 2 'pending_review' rows
--        into states consistent with ai_interview_score / second interview
--   9    Rebuild admin_status_type enum: keep only the 6 used values
--        (active, pending_2nd_interview, ai_interview_failed, approved,
--         pending_review, rejected). Drop pending_speaking_review,
--         profile_review.
--   10   Change admin_status column default from 'pending_speaking_review'
--        to 'active'
--   11   Rebuild get_candidates_with_skills RPC without speaking_level
--        parameter / column
--
-- Atomicity preserved by exec_sql RPC's implicit function-level transaction:
-- PostgreSQL wraps each RPC invocation in an implicit transaction, so any
-- statement failing rolls the entire migration back. Explicit BEGIN/COMMIT
-- omitted because PL/pgSQL's EXECUTE (used by exec_sql) cannot run
-- transaction-control commands.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Drop candidate_interviews.speaking_level_updated_to ────────────────
-- Column was written by the deprecated `update_spoken_score` admin action
-- (removed in Phase C). No application code still reads it.
ALTER TABLE candidate_interviews DROP COLUMN IF EXISTS speaking_level_updated_to;

-- ─── 2. Drop candidates.speaking_level ─────────────────────────────────────
-- Steps 2-8 removed every read/write site in application code. The column
-- is only referenced by the old get_candidates_with_skills RPC which is
-- rebuilt in step 11 below.
ALTER TABLE candidates DROP COLUMN IF EXISTS speaking_level;

-- ─── 3. Drop candidates.spoken_english_score ──────────────────────────────
-- Column was written by the deprecated `update_spoken_score` admin action
-- (removed in Phase C). No application code still reads it.
ALTER TABLE candidates DROP COLUMN IF EXISTS spoken_english_score;

-- ─── 4. Drop candidates.spoken_english_result ─────────────────────────────
-- Same as #3 — orphaned after Phase C.
ALTER TABLE candidates DROP COLUMN IF EXISTS spoken_english_result;

-- ─── 5. Drop speaking_level_type enum ─────────────────────────────────────
-- No longer used by any column after step 2. The old RPC body still
-- mentions this type textually, but plpgsql bodies don't create hard
-- catalog dependencies, so DROP TYPE succeeds. The RPC is replaced in
-- step 11 before the transaction commits, so no caller ever sees the
-- broken intermediate state.
DROP TYPE IF EXISTS speaking_level_type;

-- ─── 6. Migrate 'pending_speaking_review' rows with NULL ai_interview_score → 'active' ─
-- 110 rows in production are stuck at 'pending_speaking_review' because it
-- was the historical DEFAULT for the admin_status column — they never
-- took the AI interview. Move them back to the pre-AI-interview state
-- ('active') so the pipeline can re-process them normally.
UPDATE candidates
SET admin_status = 'active'
WHERE admin_status = 'pending_speaking_review'
  AND ai_interview_score IS NULL;

-- ─── 7. Migrate remaining 'pending_speaking_review' rows by AI score ──────
-- After step 6, any remaining pending_speaking_review rows DID take the
-- AI interview. Split them the same way the webhook does:
--   score >= 60 → pending_2nd_interview (passed, awaiting recruiter)
--   score < 60  → ai_interview_failed   (failed, 3-day retake lockout)
UPDATE candidates
SET admin_status = 'pending_2nd_interview'
WHERE admin_status = 'pending_speaking_review'
  AND ai_interview_score >= 60;

UPDATE candidates
SET admin_status = 'ai_interview_failed'
WHERE admin_status = 'pending_speaking_review'
  AND ai_interview_score < 60;

-- ─── 8. Migrate orphan 'pending_review' rows ──────────────────────────────
-- 'pending_review' is the valid step-10 status (profile review before push
-- live), but 2 rows in production are stranded there without having
-- completed their 2nd interview. Move each to a state consistent with
-- their actual progress; rows that HAVE completed the 2nd interview stay
-- at pending_review (they're legitimately at step 10).
UPDATE candidates
SET admin_status = 'active'
WHERE admin_status = 'pending_review'
  AND ai_interview_score IS NULL;

UPDATE candidates
SET admin_status = 'pending_2nd_interview'
WHERE admin_status = 'pending_review'
  AND ai_interview_score >= 60
  AND second_interview_status IS NULL;

UPDATE candidates
SET admin_status = 'ai_interview_failed'
WHERE admin_status = 'pending_review'
  AND ai_interview_score < 60;

-- ─── 9. Rebuild admin_status_type enum (create-new-rename-old dance) ──────
-- Final set of 6 valid values. Dropping: 'pending_speaking_review' (now
-- empty after steps 6-7) and 'profile_review' (collapsed into
-- 'pending_review' which means the same thing).
-- PostgreSQL doesn't allow removing enum values in place, so we build a
-- new enum, swap the column to it, and rename.

-- 9a. Drop the column default so we can change the type freely.
ALTER TABLE candidates ALTER COLUMN admin_status DROP DEFAULT;

-- 9b. Safety net: collapse any remaining 'profile_review' rows into
-- 'pending_review' (0 expected per preflight; guards against drift).
UPDATE candidates
SET admin_status = 'pending_review'
WHERE admin_status = 'profile_review';

-- 9b.5. Drop RLS policies that reference admin_status. PostgreSQL
-- disallows ALTER COLUMN TYPE on a column referenced by any policy
-- definition — including cross-table policies on other tables (like
-- portfolio_items below) that subquery candidates.admin_status. Both
-- policies are recreated in 9g after the enum rename.
DROP POLICY IF EXISTS "Approved candidates are publicly visible" ON candidates;
DROP POLICY IF EXISTS "Portfolio items publicly visible for approved candidates" ON portfolio_items;

-- 9c. Create the new enum with only the 6 used values.
CREATE TYPE admin_status_type_new AS ENUM (
  'active',
  'pending_2nd_interview',
  'ai_interview_failed',
  'approved',
  'pending_review',
  'rejected'
);

-- 9d. Swap the column over. The text-roundtrip cast is required because
-- PostgreSQL won't implicitly cast between two distinct enum types.
ALTER TABLE candidates
  ALTER COLUMN admin_status TYPE admin_status_type_new
  USING admin_status::text::admin_status_type_new;

-- 9e. Drop the old enum. No remaining columns or RPCs depend on it.
DROP TYPE admin_status_type;

-- 9f. Rename the new enum back to the canonical name so application
-- code (which references admin_status_type) keeps working.
ALTER TYPE admin_status_type_new RENAME TO admin_status_type;

-- 9g. Recreate both RLS policies dropped in 9b.5. Placed here (after 9f)
-- rather than between 9d/9e so the expression's cast ('approved'::
-- admin_status_type) resolves to the renamed/final enum type, avoiding a
-- type mismatch with the column (admin_status_type_new != old
-- admin_status_type at 9d.5 time). Both policies match the originals
-- byte-for-byte: same name, SELECT command, USING clauses, applies to
-- PUBLIC, no WITH CHECK clauses.
CREATE POLICY "Approved candidates are publicly visible" ON candidates
  FOR SELECT
  USING (admin_status = 'approved'::admin_status_type);

CREATE POLICY "Portfolio items publicly visible for approved candidates" ON portfolio_items
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM candidates
    WHERE candidates.id = portfolio_items.candidate_id
      AND candidates.admin_status = 'approved'::admin_status_type
  ));

-- ─── 10. Set new column default to 'active' ───────────────────────────────
-- The historical default 'pending_speaking_review' was the source of the
-- 110 orphan rows. New candidates should start at 'active' and advance
-- through the funnel via the AI interview webhook.
ALTER TABLE candidates ALTER COLUMN admin_status SET DEFAULT 'active';

-- ─── 11. Rebuild get_candidates_with_skills RPC ──────────────────────────
-- Original signature (from migration 00043) had a p_speaking_level
-- parameter and returned speaking_level as a column. Both are removed.
-- All other parameters, filters, and return fields are preserved verbatim.

-- Drop the old function by its exact 13-parameter signature.
DROP FUNCTION IF EXISTS get_candidates_with_skills(
  text, text, text, numeric, numeric, text, text, text, text, text[], text, integer, integer
);

-- Create the new function: 12 parameters (p_speaking_level removed),
-- and speaking_level removed from the filtered CTE, sorted CTE, and
-- final json output.
CREATE OR REPLACE FUNCTION get_candidates_with_skills(
  p_search text default null,
  p_role text default null,
  p_country text default null,
  p_min_rate numeric default null,
  p_max_rate numeric default null,
  p_availability text default null,
  p_tier text default null,
  p_us_experience text default null,
  p_skills text[] default null,
  p_sort text default 'newest',
  p_page integer default 1,
  p_page_size integer default 24
)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  v_offset integer;
  v_result json;
BEGIN
  v_offset := (p_page - 1) * p_page_size;

  WITH filtered AS (
    SELECT
      id, display_name, country, role_category, hourly_rate,
      english_written_tier, availability_status,
      availability_date, us_client_experience, bio, total_earnings_usd,
      committed_hours, profile_photo_url, needs_availability_update,
      voice_recording_1_preview_url, created_at, english_mc_score,
      english_comprehension_score, reputation_score, reputation_tier,
      video_intro_status, skills, tools, tagline, ai_insight_1, ai_insight_2,
      english_percentile
    FROM candidates
    WHERE admin_status = 'approved'::admin_status_type
      AND (
        p_search IS NULL
        OR display_name ILIKE '%' || p_search || '%'
        OR role_category ILIKE '%' || p_search || '%'
        OR country ILIKE '%' || p_search || '%'
        OR bio ILIKE '%' || p_search || '%'
      )
      AND (p_role IS NULL OR role_category ILIKE '%' || p_role || '%')
      AND (p_country IS NULL OR country ILIKE '%' || p_country || '%')
      AND (p_min_rate IS NULL OR hourly_rate >= p_min_rate)
      AND (p_max_rate IS NULL OR hourly_rate <= p_max_rate)
      AND (
        p_availability IS NULL
        OR (p_availability = 'available' AND committed_hours = 0)
        OR (p_availability = 'partially_available' AND committed_hours > 0 AND committed_hours < 40)
      )
      AND (p_tier IS NULL OR p_tier = 'any' OR english_written_tier = p_tier::english_written_tier_type)
      AND (
        p_us_experience IS NULL
        OR (p_us_experience = 'yes' AND us_client_experience IN ('full_time'::us_experience_type, 'part_time_contract'::us_experience_type))
        OR (p_us_experience = 'no' AND us_client_experience IN ('international_only'::us_experience_type, 'none'::us_experience_type))
      )
      AND (
        p_skills IS NULL
        OR array_length(p_skills, 1) IS NULL
        OR skills @> to_jsonb(p_skills)
      )
  ),
  counted AS (
    SELECT count(*) AS total FROM filtered
  ),
  skill_agg AS (
    SELECT
      s.skill,
      count(*) AS count
    FROM filtered f, jsonb_array_elements_text(f.skills) AS s(skill)
    GROUP BY s.skill
    ORDER BY count DESC, s.skill ASC
    LIMIT 15
  ),
  sorted AS (
    SELECT
      id, display_name, country, role_category, hourly_rate,
      english_written_tier, availability_status,
      availability_date, us_client_experience, bio, total_earnings_usd,
      committed_hours, profile_photo_url, needs_availability_update,
      voice_recording_1_preview_url, created_at, english_mc_score,
      english_comprehension_score, reputation_score, reputation_tier,
      video_intro_status, skills, tools, tagline, ai_insight_1, ai_insight_2
    FROM filtered
    ORDER BY
      CASE WHEN p_sort = 'rate_low' THEN hourly_rate END ASC NULLS LAST,
      CASE WHEN p_sort = 'rate_high' THEN hourly_rate END DESC NULLS LAST,
      CASE WHEN p_sort = 'earnings' THEN total_earnings_usd END DESC NULLS LAST,
      CASE WHEN p_sort = 'tier' THEN english_percentile END DESC NULLS LAST,
      CASE WHEN p_sort = 'newest' OR p_sort IS NULL THEN created_at END DESC NULLS LAST
    LIMIT p_page_size
    OFFSET v_offset
  )
  SELECT json_build_object(
    'candidates', coalesce((SELECT json_agg(row_to_json(s)) FROM sorted s), '[]'::json),
    'total', (SELECT total FROM counted),
    'skill_aggregation', coalesce((SELECT json_agg(json_build_object('skill', sa.skill, 'count', sa.count)) FROM skill_agg sa), '[]'::json)
  ) INTO v_result;

  RETURN v_result;
END;
$$;
