-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 00081 — profile_edit_requests
-- Branch: profile-edit-requests
-- Purpose: Support the Candidate Edit-With-Approval flow.
--          Candidates submit proposed edits to their approved profile; the
--          assigned Talent Specialist (recruiter) reviews, approves, or
--          declines each request in the existing chat thread.
--          Media edits (photo, voice recordings, video intro) stage the new
--          file in a parallel storage path and only overwrite the live URL
--          on approval.
-- Scope:
--   1. Create profile_edit_requests table (+ indexes + check constraints).
--   2. Extend recruiter_messages with message_type + edit_request_id.
--   3. RLS: candidates read/write own; assigned recruiter reads/updates.
--   4. Document staging folder conventions (no SQL — path policy only).
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 1 — profile_edit_requests table
-- ═══════════════════════════════════════════════════════════════════════════
-- One row per field-level edit request. Candidates submit one or more of
-- these when they want to change something on their already-approved
-- profile. status transitions: pending → approved | declined | cancelled.
--
-- old_value + new_value are JSONB because field types vary across the
-- editable surface (text, numeric, jsonb array, enum). For media fields
-- new_value stores the *staged* storage path/URL, not the live one; the
-- live candidates.* column is only updated at approval time.
--
-- chat_message_id is an informational FK to the recruiter_messages row that
-- materialises this request in the chat thread. It is nullable because the
-- message is inserted *after* the edit request row (so we know the id to
-- reference). ON DELETE is handled by the recruiter_messages side (see
-- Section 2) which SETs NULL on edit_request_id if the edit request is
-- deleted — we do not add a FK here to avoid a circular hard dependency.

CREATE TABLE IF NOT EXISTS profile_edit_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id    UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  -- Assigned Talent Specialist at time of submission. Nullable + SET NULL
  -- so reassignment / profile deletion of a recruiter doesn't orphan the
  -- request. The resolving TS is tracked separately in resolved_by.
  recruiter_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,

  field_name      TEXT NOT NULL,

  -- Snapshot of the live value at submission time, so the TS sees the
  -- "before" even if the live column changes between submit and review.
  old_value       JSONB,
  -- Proposed new value. For media fields this is the staged storage path.
  new_value       JSONB NOT NULL,

  status          TEXT NOT NULL DEFAULT 'pending',
  decline_reason  TEXT,

  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ,
  resolved_by     UUID REFERENCES profiles(id),

  -- FK-in-spirit to recruiter_messages.id. Kept loose (no FK constraint)
  -- to avoid an insert-ordering deadlock between the two tables.
  chat_message_id UUID,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Whitelist of editable fields. Mirrors the editable surface in the
  -- candidate profile editor. If a new editable field is added, it must
  -- also be added here in a follow-up migration.
  CONSTRAINT profile_edit_requests_field_name_check CHECK (field_name IN (
    'bio',
    'tagline',
    'skills',
    'tools',
    'role_category',
    'country',
    'hourly_rate',
    'years_experience',
    'us_client_experience',
    'profile_photo_url',
    'voice_recording_1_url',
    'voice_recording_2_url',
    'work_experience',
    'video_intro_url'
  )),

  CONSTRAINT profile_edit_requests_status_check CHECK (status IN (
    'pending', 'approved', 'declined', 'cancelled'
  )),

  -- A declined request must explain why. Approvals and cancellations do
  -- not require a reason.
  CONSTRAINT profile_edit_requests_decline_reason_required CHECK (
    CASE
      WHEN status = 'declined' THEN decline_reason IS NOT NULL AND length(trim(decline_reason)) > 0
      ELSE TRUE
    END
  )
);

CREATE INDEX IF NOT EXISTS idx_profile_edit_requests_candidate
  ON profile_edit_requests(candidate_id);

-- The TS dashboard lists pending requests for a given recruiter, so index
-- on the common filter shape.
CREATE INDEX IF NOT EXISTS idx_profile_edit_requests_recruiter_status
  ON profile_edit_requests(recruiter_id, status);

-- Partial index for the hot "pending queue" query across all TS.
CREATE INDEX IF NOT EXISTS idx_profile_edit_requests_status_pending
  ON profile_edit_requests(status) WHERE status = 'pending';


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 2 — Extend recruiter_messages
-- ═══════════════════════════════════════════════════════════════════════════
-- Edit requests appear inline in the existing recruiter/candidate chat.
-- Rather than a separate notifications table, each request inserts a
-- recruiter_messages row of type 'edit_request' pointing back to the
-- profile_edit_requests row. Regular chat messages keep message_type =
-- 'regular' (default), so existing rows are unaffected.
--
-- NOTE: recruiter_messages already has RLS + three FOR ALL policies
-- (recruiter, candidate, service_role) from migration 00045. Those
-- policies operate on recruiter_id / candidate_id, so adding new columns
-- does not conflict — existing policies continue to gate reads and writes
-- as before.

ALTER TABLE recruiter_messages
  ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'regular';

ALTER TABLE recruiter_messages
  ADD COLUMN IF NOT EXISTS edit_request_id UUID
    REFERENCES profile_edit_requests(id) ON DELETE SET NULL;

-- Whitelist message types. Keep the set small; if a future message class
-- is needed (e.g. 'system'), add it in a follow-up migration.
DO $$ BEGIN
  ALTER TABLE recruiter_messages
    ADD CONSTRAINT recruiter_messages_message_type_check
    CHECK (message_type IN ('regular', 'edit_request'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- edit_request messages must point to a concrete edit request row.
DO $$ BEGIN
  ALTER TABLE recruiter_messages
    ADD CONSTRAINT recruiter_messages_edit_request_id_required
    CHECK (
      CASE
        WHEN message_type = 'edit_request' THEN edit_request_id IS NOT NULL
        ELSE TRUE
      END
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Partial index: only edit_request messages need this lookup, and they are
-- a small fraction of the table. Keeps the index tight.
CREATE INDEX IF NOT EXISTS idx_recruiter_messages_edit_request
  ON recruiter_messages(edit_request_id) WHERE edit_request_id IS NOT NULL;


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 3 — RLS on profile_edit_requests
-- ═══════════════════════════════════════════════════════════════════════════
-- Two principals: the candidate who owns the profile, and the assigned TS.
-- Service role bypasses RLS by default for admin tooling. We keep the
-- policies narrow — no cross-recruiter visibility, no candidate visibility
-- of other candidates' requests.
--
-- UPDATE policies are intentionally permissive at the row level (any
-- candidate on their own row; any assigned TS on theirs). Application-
-- layer logic in the API routes enforces the *allowed transitions*:
--   - candidate may only move pending → cancelled
--   - recruiter may only move pending → approved | declined
-- Encoding transition rules in SQL triggers would couple DB to workflow
-- too tightly at this stage; revisit if we see abuse.

ALTER TABLE profile_edit_requests ENABLE ROW LEVEL SECURITY;

-- Policy 1 — candidates read their own requests (for the edit-status UI).
DO $$ BEGIN
  CREATE POLICY "Candidates view own edit requests" ON profile_edit_requests
    FOR SELECT USING (
      candidate_id IN (SELECT id FROM candidates WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Policy 2 — candidates submit new requests for their own candidate row.
DO $$ BEGIN
  CREATE POLICY "Candidates insert own edit requests" ON profile_edit_requests
    FOR INSERT WITH CHECK (
      candidate_id IN (SELECT id FROM candidates WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Policy 3 — candidates update their own requests (cancellation flow).
DO $$ BEGIN
  CREATE POLICY "Candidates cancel own edit requests" ON profile_edit_requests
    FOR UPDATE USING (
      candidate_id IN (SELECT id FROM candidates WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Policy 4 — assigned TS reads requests routed to them.
DO $$ BEGIN
  CREATE POLICY "Recruiters view assigned edit requests" ON profile_edit_requests
    FOR SELECT USING (
      recruiter_id = auth.uid()
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Policy 5 — assigned TS approves / declines.
DO $$ BEGIN
  CREATE POLICY "Recruiters resolve assigned edit requests" ON profile_edit_requests
    FOR UPDATE USING (
      recruiter_id = auth.uid()
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Service role full access — matches the convention used by other tables
-- (see recruiter_messages 00045) so admin jobs and cron workers can
-- operate without RLS interference.
DO $$ BEGIN
  CREATE POLICY "Service role full access to profile_edit_requests"
    ON profile_edit_requests
    FOR ALL
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 4 — Staging storage conventions (documentation only)
-- ═══════════════════════════════════════════════════════════════════════════
-- Media edits must not clobber the live file until approval. The upload
-- endpoint stages new media into a parallel path inside the existing
-- buckets (no new bucket required — reuses permissions + signed-URL setup
-- already wired for these buckets).
--
-- Existing live buckets + path conventions (discovered in preflight):
--   profile-photos   : {candidateId}/photo-{timestamp}.{ext}    (public URLs)
--   voice-recordings : {candidateId}/oral-reading-{timestamp}.webm (signed URLs)
--   voice-recordings : {candidateId}/open-ended-{timestamp}.webm   (signed URLs)
--   video-intros     : {candidateId}/{...}                     (signed URLs)
--
-- Staging paths (new, used only by the edit-with-approval flow):
--   profile-photos   /staged/{edit_request_id}.{ext}
--   voice-recordings /staged/{edit_request_id}.{ext}
--   video-intros     /staged/{edit_request_id}.{ext}
--
-- On approval: the API route moves (or copies + deletes) the staged file
-- into the live path and updates candidates.<field>_url atomically with
-- the profile_edit_requests.status transition.
-- On decline / cancel: the staged file is deleted. No orphan cleanup cron
-- is added in this migration — if one becomes necessary, see resolved_at
-- to find stale staged uploads.
--
-- No SQL is emitted in this section; bucket ACL + policy wiring is managed
-- in the Supabase dashboard and reused as-is.
