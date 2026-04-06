-- Video introduction revision tracking
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS video_intro_revision_requested boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN candidates.video_intro_revision_requested IS 'Set true when a revision request includes video intro items. Reset to false when candidate submits new video. Filters admin video review queue.';

-- Also add recruiter dashboard support columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS daily_interview_target integer NOT NULL DEFAULT 14;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS recruiter_type text NOT NULL DEFAULT 'full_time';

DO $$ BEGIN
  ALTER TABLE profiles ADD CONSTRAINT chk_recruiter_type
    CHECK (recruiter_type IN ('full_time', 'part_time'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN profiles.daily_interview_target IS 'Daily second-interview target. Default 14 for full-time, 7 for part-time.';
COMMENT ON COLUMN profiles.recruiter_type IS 'full_time or part_time — drives default interview target.';
