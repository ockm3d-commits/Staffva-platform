DO $$ BEGIN CREATE TYPE contract_status_type AS ENUM ('draft','pending_client','pending_candidate','fully_executed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS engagement_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id UUID NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id),
  client_id UUID NOT NULL REFERENCES clients(id),
  contract_html TEXT NOT NULL,
  contract_pdf_url TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  client_signed_at TIMESTAMPTZ,
  candidate_signed_at TIMESTAMPTZ,
  client_signature_ip TEXT,
  candidate_signature_ip TEXT,
  signing_token TEXT,
  status contract_status_type NOT NULL DEFAULT 'draft'
);

CREATE INDEX IF NOT EXISTS idx_contracts_engagement ON engagement_contracts(engagement_id);
CREATE INDEX IF NOT EXISTS idx_contracts_signing_token ON engagement_contracts(signing_token);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON engagement_contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_candidate ON engagement_contracts(candidate_id);
CREATE INDEX IF NOT EXISTS idx_contracts_client ON engagement_contracts(client_id);

-- Create storage bucket for contracts
INSERT INTO storage.buckets (id, name, public) VALUES ('contracts', 'contracts', false) ON CONFLICT (id) DO NOTHING;
