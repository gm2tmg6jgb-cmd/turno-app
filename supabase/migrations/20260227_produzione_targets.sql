-- Tabella per salvare i target di produzione per progetto
CREATE TABLE IF NOT EXISTS produzione_targets (
    progetto_id   TEXT PRIMARY KEY,
    daily_target  INTEGER,
    days          INTEGER,
    weekly_target INTEGER,
    shift_target  INTEGER
);
