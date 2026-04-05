ALTER TABLE candidates ADD COLUMN IF NOT EXISTS integrity_pledge_accepted BOOLEAN DEFAULT false;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS integrity_pledge_accepted_at TIMESTAMPTZ;
