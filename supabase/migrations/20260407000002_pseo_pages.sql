CREATE TABLE pseo_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  provincie TEXT NOT NULL,
  stad TEXT NOT NULL,
  wijk TEXT,
  straat TEXT,
  postcode_prefix TEXT,
  titel TEXT,
  meta_description TEXT,
  hoofdtekst TEXT,
  faq_items JSONB DEFAULT '[]'::jsonb,
  json_ld JSONB DEFAULT '{}'::jsonb,
  gem_bouwjaar INTEGER,
  gem_health_score FLOAT,
  netcongestie_status TEXT,
  aantal_woningen INTEGER,
  generated_at TIMESTAMPTZ,
  revalidate_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')
);

CREATE INDEX pseo_provincie_idx ON pseo_pages(provincie, stad);
CREATE INDEX pseo_slug_idx ON pseo_pages(slug);
