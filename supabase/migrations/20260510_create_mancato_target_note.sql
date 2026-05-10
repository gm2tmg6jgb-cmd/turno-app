CREATE TABLE IF NOT EXISTS mancato_target_note (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data            DATE NOT NULL,
    settimana       DATE NOT NULL,          -- lunedì della settimana (per filtro settimanale)
    macchina_id     TEXT NOT NULL,
    componente      TEXT NOT NULL,
    progetto        TEXT NOT NULL,
    fase            TEXT NOT NULL,
    target          INTEGER NOT NULL DEFAULT 0,
    prodotto        INTEGER NOT NULL DEFAULT 0,
    mancante        INTEGER NOT NULL DEFAULT 0,
    causa_comp      TEXT,                  -- componente che ha occupato la macchina
    causa_pezzi     INTEGER,               -- pezzi prodotti del componente causa
    motivo          TEXT,                  -- codice motivo predefinito
    note_libere     TEXT,                  -- testo libero aggiuntivo
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),

    UNIQUE (data, macchina_id, componente, fase)   -- una nota per combinazione giorno+macchina+componente+fase
);

CREATE INDEX IF NOT EXISTS idx_mancato_target_data      ON mancato_target_note (data);
CREATE INDEX IF NOT EXISTS idx_mancato_target_settimana ON mancato_target_note (settimana);
CREATE INDEX IF NOT EXISTS idx_mancato_target_macchina  ON mancato_target_note (macchina_id);
