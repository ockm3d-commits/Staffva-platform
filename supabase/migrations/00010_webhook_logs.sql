-- Stripe webhook log
CREATE TABLE IF NOT EXISTS webhook_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'stripe',
  event_type TEXT NOT NULL,
  event_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMPTZ,
  error TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_webhook_log_processed ON webhook_log(processed) WHERE processed = false;
CREATE INDEX IF NOT EXISTS idx_webhook_log_event_id ON webhook_log(event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_log_received ON webhook_log(received_at);

-- Trolley payout callback log
CREATE TABLE IF NOT EXISTS trolley_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  event_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMPTZ,
  error TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_trolley_log_processed ON trolley_log(processed) WHERE processed = false;
CREATE INDEX IF NOT EXISTS idx_trolley_log_received ON trolley_log(received_at);
