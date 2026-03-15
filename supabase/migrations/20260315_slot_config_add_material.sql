-- Aggiunge filtro per codice materiale agli slot configurati
ALTER TABLE slot_config ADD COLUMN IF NOT EXISTS codice_materiale text;
