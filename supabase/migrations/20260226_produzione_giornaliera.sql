-- Tabella produzione giornaliera per macchina
-- Traccia i contatori lettura (inizio/fine) per soft, hard, HT e washing
-- Una riga per macchina per giorno

CREATE TABLE IF NOT EXISTS produzione_giornaliera (
    id            UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
    data          DATE         NOT NULL,
    macchina_id   TEXT         NOT NULL,
    start_soft    INTEGER,
    end_soft      INTEGER,
    ht            INTEGER,
    start_hard    INTEGER,
    end_hard      INTEGER,
    washing       INTEGER,
    note          TEXT,
    updated_at    TIMESTAMPTZ  DEFAULT NOW(),
    CONSTRAINT produzione_giornaliera_unique UNIQUE (data, macchina_id)
);

-- RLS: accesso libero (app interna, nessun utente esterno)
ALTER TABLE produzione_giornaliera ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on produzione_giornaliera"
    ON produzione_giornaliera FOR ALL USING (true) WITH CHECK (true);

-- Indice per query per data
CREATE INDEX IF NOT EXISTS idx_produzione_giornaliera_data
    ON produzione_giornaliera (data);
