-- Structured profile revision requests replacing free-text revision notes
CREATE TABLE IF NOT EXISTS profile_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  items jsonb NOT NULL, -- array of {type: string, note: string}
  status text NOT NULL DEFAULT 'pending', -- pending | completed | dismissed
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- Constrain status values
DO $$ BEGIN
  ALTER TABLE profile_revisions ADD CONSTRAINT chk_profile_revision_status
    CHECK (status IN ('pending', 'completed', 'dismissed'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Index for querying open revisions by candidate
CREATE INDEX IF NOT EXISTS idx_profile_revisions_candidate_status
  ON profile_revisions (candidate_id, status);

-- RLS
ALTER TABLE profile_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recruiters and managers can read revisions"
  ON profile_revisions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('recruiter', 'recruiting_manager', 'admin')
    )
  );

CREATE POLICY "Recruiters and managers can insert revisions"
  ON profile_revisions FOR INSERT
  WITH CHECK (
    requested_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('recruiter', 'recruiting_manager', 'admin')
    )
  );

CREATE POLICY "Recruiters and managers can update revisions"
  ON profile_revisions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('recruiter', 'recruiting_manager', 'admin')
    )
  );

CREATE POLICY "Candidates can read own revisions"
  ON profile_revisions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM candidates
      WHERE candidates.id = profile_revisions.candidate_id
        AND candidates.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role full access on profile_revisions"
  ON profile_revisions FOR ALL
  USING (auth.role() = 'service_role');
