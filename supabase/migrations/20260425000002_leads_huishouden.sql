-- Voeg huishouden_grootte kolom toe aan leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS huishouden_grootte SMALLINT
  CHECK (huishouden_grootte IN (1, 2, 3));
