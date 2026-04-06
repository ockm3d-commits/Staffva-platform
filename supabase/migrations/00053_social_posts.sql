-- Social posts tracking: max 2 posts per recruiter per day
CREATE TABLE IF NOT EXISTS social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_url text NOT NULL,
  post_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Performance index for lookups by recruiter + date
CREATE INDEX IF NOT EXISTS idx_social_posts_recruiter_date ON social_posts (recruiter_id, post_date);

-- Enforce maximum 2 posts per recruiter per day using a unique partial index trick:
-- We create a helper column-free approach with a function + check constraint.
-- Simpler approach: use a unique index on (recruiter_id, post_date, post_number)
-- where post_number is derived. Instead, use a trigger to reject the 3rd insert.

CREATE OR REPLACE FUNCTION enforce_max_two_posts_per_day()
RETURNS trigger AS $$
DECLARE
  post_count integer;
BEGIN
  SELECT count(*) INTO post_count
  FROM social_posts
  WHERE recruiter_id = NEW.recruiter_id
    AND post_date = NEW.post_date;

  -- post_count includes the row being inserted in AFTER triggers,
  -- but in BEFORE triggers it does not. This is a BEFORE trigger.
  IF post_count >= 2 THEN
    RAISE EXCEPTION 'Maximum 2 social posts per recruiter per day. Recruiter % already has 2 posts on %.',
      NEW.recruiter_id, NEW.post_date;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_max_two_posts_per_day ON social_posts;
CREATE TRIGGER trg_max_two_posts_per_day
  BEFORE INSERT ON social_posts
  FOR EACH ROW
  EXECUTE FUNCTION enforce_max_two_posts_per_day();

-- RLS
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recruiters can read own posts"
  ON social_posts FOR SELECT
  USING (recruiter_id = auth.uid());

CREATE POLICY "Recruiters can insert own posts"
  ON social_posts FOR INSERT
  WITH CHECK (recruiter_id = auth.uid());

CREATE POLICY "Service role full access on social_posts"
  ON social_posts FOR ALL
  USING (auth.role() = 'service_role');
