-- Aggiunge tecnologia_id a motivi_fermo
-- Ogni motivo appartiene a una specifica famiglia tecnologica
-- NULL = motivo orfano (vecchi dati, non usati)
ALTER TABLE motivi_fermo
    ADD COLUMN IF NOT EXISTS tecnologia_id TEXT REFERENCES tecnologie_fermo(id) ON DELETE CASCADE;
