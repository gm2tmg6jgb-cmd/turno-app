-- Tabella Anagrafica Materiali
-- Associa codici SAP a nomi componenti leggibili

CREATE TABLE IF NOT EXISTS anagrafica_materiali (
    id          BIGSERIAL PRIMARY KEY,
    codice      TEXT UNIQUE NOT NULL, -- es. SCA14025
    componente  TEXT NOT NULL,      -- es. SG2
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE anagrafica_materiali ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for authenticated users" ON anagrafica_materiali FOR ALL USING (true);
