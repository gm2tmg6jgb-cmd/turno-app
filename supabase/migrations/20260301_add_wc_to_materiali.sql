-- Migration: Add centri_di_lavoro to anagrafica_materiali
ALTER TABLE anagrafica_materiali ADD COLUMN IF NOT EXISTS centri_di_lavoro TEXT;

-- Optional: Populate existing data from conferme_sap (if performance allows)
-- This might be slow if run directly in a migration on 140k rows, 
-- but we can handle it in the frontend or via a background job.
