-- Aggiunge colonna motivi_ids a tecnologie_fermo
-- Stringa CSV di motivo IDs (es. "guasto_meccanico,attrezzaggio")
-- Vuota = tutti i motivi disponibili
ALTER TABLE tecnologie_fermo
    ADD COLUMN IF NOT EXISTS motivi_ids TEXT NOT NULL DEFAULT '';
