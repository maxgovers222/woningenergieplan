CREATE TABLE netcongestie_cache (
  postcode_prefix TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('ROOD', 'ORANJE', 'GROEN')),
  netbeheerder TEXT,
  capaciteit_details JSONB DEFAULT '{}'::jsonb,
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE TABLE b2b_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  naam TEXT NOT NULL,
  webhook_url TEXT NOT NULL,
  api_key_hash TEXT NOT NULL,
  actief BOOLEAN DEFAULT TRUE,
  lead_filter JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for cache expiry cleanup queries
CREATE INDEX netcongestie_expires_idx ON netcongestie_cache(expires_at);

-- Add updated_at to b2b_partners for audit trail
ALTER TABLE b2b_partners ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
