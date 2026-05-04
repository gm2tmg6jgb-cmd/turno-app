ALTER TABLE conferme_sap ADD COLUMN IF NOT EXISTS acq_da TEXT;
ALTER TABLE conferme_sap ADD COLUMN IF NOT EXISTS sto TEXT;

CREATE INDEX IF NOT EXISTS idx_conferme_sap_acq_da ON conferme_sap (acq_da);
CREATE INDEX IF NOT EXISTS idx_conferme_sap_sto ON conferme_sap (sto);
