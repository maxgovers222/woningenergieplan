-- Voeg dakrichting en verbruik_bron kolommen toe aan leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS dakrichting TEXT
  CHECK (dakrichting IN ('Zuid', 'Oost/West', 'Noord'));
ALTER TABLE leads ADD COLUMN IF NOT EXISTS verbruik_bron TEXT
  CHECK (verbruik_bron IN ('schatting', 'gebruiker'));
