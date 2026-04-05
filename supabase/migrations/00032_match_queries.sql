CREATE TABLE IF NOT EXISTS match_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  query_text TEXT NOT NULL,
  extracted_role_category TEXT,
  extracted_skills TEXT[],
  extracted_experience_level TEXT,
  extracted_hours_preference INTEGER,
  results_candidate_ids UUID[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_queries_client ON match_queries(client_id);
CREATE INDEX IF NOT EXISTS idx_match_queries_created ON match_queries(created_at);
