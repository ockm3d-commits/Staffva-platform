DO $$ BEGIN CREATE TYPE offer_status_type AS ENUM ('draft','sent','viewed','accepted','declined','expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE rate_comparison_type AS ENUM ('above','at','below'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS engagement_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  hourly_rate NUMERIC(10,2) NOT NULL,
  hours_per_week INTEGER NOT NULL,
  contract_length TEXT NOT NULL,
  start_date DATE NOT NULL,
  signing_bonus_usd NUMERIC(10,2),
  personal_message TEXT,
  estimated_monthly_cost NUMERIC(10,2),
  estimated_contract_total NUMERIC(10,2),
  candidate_rate_comparison rate_comparison_type,
  status offer_status_type NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_offers_candidate ON engagement_offers(candidate_id);
CREATE INDEX IF NOT EXISTS idx_offers_client ON engagement_offers(client_id);
CREATE INDEX IF NOT EXISTS idx_offers_status ON engagement_offers(status);
