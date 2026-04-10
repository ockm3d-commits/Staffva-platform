-- ============================================================
-- Migration 00070: Add RLS policies for recruiter candidate access
-- ============================================================
-- Recruiters need to read and update candidates assigned to them.
-- The assigned_recruiter column is TEXT and may contain either a
-- UUID string or a recruiter name. Cast auth.uid() to text for
-- safe comparison against all values.
-- ============================================================

-- SELECT: Recruiters can read candidates assigned to them
DO $$ BEGIN
  CREATE POLICY "Recruiters can read assigned candidates" ON candidates
    FOR SELECT USING (assigned_recruiter = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- UPDATE: Recruiters can update candidates assigned to them
DO $$ BEGIN
  CREATE POLICY "Recruiters can update assigned candidates" ON candidates
    FOR UPDATE USING (assigned_recruiter = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
