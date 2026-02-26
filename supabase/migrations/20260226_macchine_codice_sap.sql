-- Aggiunta campo codice_sap alla tabella macchine per integrazione con SAP
ALTER TABLE macchine ADD COLUMN IF NOT EXISTS codice_sap TEXT;

-- Opzionale: popolamento iniziale con l'ID macchina se presente (fallback)
-- UPDATE macchine SET codice_sap = id WHERE codice_sap IS NULL;
