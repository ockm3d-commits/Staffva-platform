DO $$ BEGIN CREATE TYPE screening_queue_status AS ENUM ('pending', 'processing', 'complete', 'failed', 'rate_limited'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS screening_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status screening_queue_status NOT NULL DEFAULT 'pending',
  retry_count INTEGER NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  error_text TEXT,
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_screening_queue_status ON screening_queue(status) WHERE status IN ('pending', 'rate_limited');
CREATE INDEX IF NOT EXISTS idx_screening_queue_candidate ON screening_queue(candidate_id);
CREATE INDEX IF NOT EXISTS idx_screening_queue_next_retry ON screening_queue(next_retry_at);
