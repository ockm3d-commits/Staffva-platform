-- Migration 00078: Add recruiter private notes column to candidates
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS recruiter_notes text;
NOTIFY pgrst, 'reload schema';
