ALTER TABLE applications ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'applied';

-- The business mutation and its event are committed in the same transaction.
-- Events deliberately exclude names, email, resumes, credentials and JWTs.
CREATE TABLE IF NOT EXISTS cloud_outbox (
  event_id UUID PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  lease_token UUID,
  leased_until TIMESTAMPTZ,
  dispatched_at TIMESTAMPTZ,
  dead_lettered_at TIMESTAMPTZ,
  last_error_code VARCHAR(100)
);
CREATE INDEX IF NOT EXISTS cloud_outbox_pending_idx ON cloud_outbox (available_at, created_at)
  WHERE dispatched_at IS NULL AND dead_lettered_at IS NULL;
