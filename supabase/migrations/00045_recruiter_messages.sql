-- Create recruiter_messages table for recruiter-candidate messaging
CREATE TABLE IF NOT EXISTS recruiter_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  sender_role  text NOT NULL CHECK (sender_role IN ('recruiter', 'candidate')),
  body         text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  read_at      timestamptz
);

-- Indexes for fast lookups by recruiter and candidate
CREATE INDEX idx_recruiter_messages_recruiter_id ON recruiter_messages(recruiter_id);
CREATE INDEX idx_recruiter_messages_candidate_id ON recruiter_messages(candidate_id);

-- Composite index for thread lookups (recruiter + candidate ordered by time)
CREATE INDEX idx_recruiter_messages_thread ON recruiter_messages(recruiter_id, candidate_id, created_at DESC);

-- RLS policies
ALTER TABLE recruiter_messages ENABLE ROW LEVEL SECURITY;

-- Recruiters can read/write messages for their assigned candidates
CREATE POLICY "Recruiters can manage their messages"
  ON recruiter_messages
  FOR ALL
  USING (recruiter_id IN (
    SELECT id FROM profiles WHERE id = auth.uid() AND role = 'recruiter'
  ));

-- Candidates can read/write messages with their assigned recruiter
CREATE POLICY "Candidates can manage their messages"
  ON recruiter_messages
  FOR ALL
  USING (candidate_id IN (
    SELECT id FROM candidates WHERE user_id = auth.uid()
  ));

-- Service role full access
CREATE POLICY "Service role full access to recruiter_messages"
  ON recruiter_messages
  FOR ALL
  USING (auth.role() = 'service_role');
