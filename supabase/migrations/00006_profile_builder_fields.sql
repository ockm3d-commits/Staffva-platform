-- ============================================================
-- StaffVA — Profile Builder Fields
-- Adds columns needed for the enhanced candidate profile builder.
-- Run in Supabase SQL Editor.
-- ============================================================

-- New candidate profile fields
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS tagline TEXT CHECK (char_length(tagline) <= 80);
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS tools JSONB DEFAULT '[]'::jsonb;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS work_experience JSONB DEFAULT '[]'::jsonb;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS profile_completed_at TIMESTAMPTZ;

-- Storage bucket for profile photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-photos', 'profile-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for profile photos
DO $$ BEGIN
  CREATE POLICY "Candidates can upload profile photos" ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'profile-photos' AND auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Profile photos are publicly readable" ON storage.objects FOR SELECT
    USING (bucket_id = 'profile-photos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Candidates can update own profile photos" ON storage.objects FOR UPDATE
    USING (bucket_id = 'profile-photos' AND auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
