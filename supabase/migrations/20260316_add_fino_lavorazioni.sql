-- Aggiunge il numero di operazione SAP (Fino) a conferme_sap
ALTER TABLE conferme_sap ADD COLUMN IF NOT EXISTS fino TEXT;

-- Tabella lavorazioni: per ogni codice materiale, le fasi di lavorazione SAP
CREATE TABLE IF NOT EXISTS lavorazioni (
    id          BIGSERIAL PRIMARY KEY,
    codice_materiale TEXT NOT NULL,      -- es. M0162523/S (rif. anagrafica_materiali.codice)
    fino        TEXT,                    -- numero operazione SAP (es. "0010", "0140")
    componente  TEXT,                    -- nome fase nel nostro sistema (es. "SGR", "SG2")
    descrizione TEXT,                   -- descrizione libera (es. "Tornitura Soft", "Tornitura Hard")
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (codice_materiale, fino)
);
