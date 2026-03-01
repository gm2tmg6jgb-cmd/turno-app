-- Migration: Add ora to conferme_sap
ALTER TABLE conferme_sap ADD COLUMN IF NOT EXISTS ora TIME;

-- Optional: Index for deduplication performance
CREATE INDEX IF NOT EXISTS idx_conferme_sap_dedup ON conferme_sap (data, ora, materiale, work_center_sap, qta_ottenuta);
