-- Video intro status enum
DO $$ BEGIN CREATE TYPE video_intro_status_type AS ENUM ('pending_review','approved','revision_required','rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Video intro review decision enum
DO $$ BEGIN CREATE TYPE video_review_decision_type AS ENUM ('approved','revision_required','rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add video intro columns to candidates
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS video_intro_url TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS video_intro_thumbnail_url TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS video_intro_status video_intro_status_type;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS video_intro_submitted_at TIMESTAMPTZ;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS video_intro_reviewed_at TIMESTAMPTZ;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS video_intro_admin_note TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS video_intro_raffle_tickets_awarded BOOLEAN DEFAULT false;

-- Video intro reviews table
CREATE TABLE IF NOT EXISTS video_intro_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  admin_user_id UUID,
  decision video_review_decision_type NOT NULL,
  admin_note TEXT,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_video_reviews_candidate ON video_intro_reviews(candidate_id);

-- Add raffle ticket count to giveaway_entries
ALTER TABLE giveaway_entries ADD COLUMN IF NOT EXISTS raffle_ticket_count INTEGER DEFAULT 0;

-- Create video-intros storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('video-intros', 'video-intros', false) ON CONFLICT (id) DO NOTHING;
