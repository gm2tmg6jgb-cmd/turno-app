-- Migration to add termination fields to dipendenti table
ALTER TABLE dipendenti ADD COLUMN IF NOT EXISTS attivo BOOLEAN DEFAULT TRUE;
ALTER TABLE dipendenti ADD COLUMN IF NOT EXISTS data_fine_rapporto DATE;

-- Update existing records to be active by default if not already set
UPDATE dipendenti SET attivo = TRUE WHERE attivo IS NULL;
