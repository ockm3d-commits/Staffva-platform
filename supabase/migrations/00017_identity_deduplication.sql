CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Verified identities table
CREATE TABLE IF NOT EXISTS verified_identities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  identity_hash TEXT UNIQUE NOT NULL,
  stripe_verification_session_id TEXT NOT NULL,
  candidate_id UUID REFERENCES candidates(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  is_duplicate BOOLEAN DEFAULT false,
  duplicate_of_candidate_id UUID REFERENCES candidates(id) ON DELETE SET NULL,
  flagged_for_review BOOLEAN DEFAULT false,
  review_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_verified_identities_hash ON verified_identities(identity_hash);
CREATE INDEX IF NOT EXISTS idx_verified_identities_candidate ON verified_identities(candidate_id);
CREATE INDEX IF NOT EXISTS idx_verified_identities_duplicate ON verified_identities(is_duplicate) WHERE is_duplicate = true;

-- English test lockouts table (lockout_expires_at set by trigger)
CREATE TABLE IF NOT EXISTS english_test_lockouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  identity_hash TEXT NOT NULL,
  candidate_id UUID REFERENCES candidates(id) ON DELETE SET NULL,
  failed_at TIMESTAMPTZ DEFAULT now(),
  lockout_expires_at TIMESTAMPTZ,
  attempt_number INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_lockouts_hash ON english_test_lockouts(identity_hash);
CREATE INDEX IF NOT EXISTS idx_lockouts_expires ON english_test_lockouts(lockout_expires_at);

-- Trigger: auto-set lockout_expires_at = failed_at + 3 days
-- Only set default lockout if not explicitly provided
CREATE OR REPLACE FUNCTION set_lockout_expiry()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lockout_expires_at IS NULL THEN
    NEW.lockout_expires_at := NEW.failed_at + interval '3 days';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_lockout_expiry_trigger ON english_test_lockouts;
CREATE TRIGGER set_lockout_expiry_trigger
  BEFORE INSERT ON english_test_lockouts
  FOR EACH ROW EXECUTE FUNCTION set_lockout_expiry();

-- Function: check if an identity hash is currently locked out
CREATE OR REPLACE FUNCTION check_identity_lockout(p_identity_hash TEXT)
RETURNS JSON AS $$
DECLARE
  lockout_record RECORD;
  result JSON;
BEGIN
  SELECT l.lockout_expires_at, l.candidate_id
  INTO lockout_record
  FROM english_test_lockouts l
  WHERE l.identity_hash = p_identity_hash
    AND l.lockout_expires_at > now()
  ORDER BY l.lockout_expires_at DESC
  LIMIT 1;

  IF FOUND THEN
    result := json_build_object(
      'is_locked', true,
      'lockout_expires_at', lockout_record.lockout_expires_at,
      'original_candidate_id', lockout_record.candidate_id
    );
  ELSE
    result := json_build_object(
      'is_locked', false,
      'lockout_expires_at', NULL,
      'original_candidate_id', NULL
    );
  END IF;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
