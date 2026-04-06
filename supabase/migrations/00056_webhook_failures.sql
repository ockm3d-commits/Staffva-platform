-- Stripe webhook failure log for admin alerting
CREATE TABLE IF NOT EXISTS webhook_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  stripe_event_id text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_webhook_failures_unresolved
  ON webhook_failures (resolved) WHERE resolved = false;

ALTER TABLE webhook_failures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on webhook_failures"
  ON webhook_failures FOR ALL
  USING (auth.role() = 'service_role');
