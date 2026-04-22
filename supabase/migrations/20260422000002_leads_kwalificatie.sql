ALTER TABLE leads ADD COLUMN IF NOT EXISTS is_eigenaar BOOLEAN;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS heeft_panelen BOOLEAN;

COMMENT ON COLUMN leads.is_eigenaar IS 'true = eigenaar, false = huurder, null = niet ingevuld';
COMMENT ON COLUMN leads.heeft_panelen IS 'true = heeft al zonnepanelen, false = geen panelen, null = niet ingevuld';
