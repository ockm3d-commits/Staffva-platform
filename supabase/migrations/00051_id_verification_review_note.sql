ALTER TABLE candidates ADD COLUMN IF NOT EXISTS id_verification_review_note TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS id_verification_reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS id_verification_reviewed_at TIMESTAMPTZ;
