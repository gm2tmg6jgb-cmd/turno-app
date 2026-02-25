-- Anagrafica famiglie tecnologiche per raggruppamento fermi
CREATE TABLE IF NOT EXISTS tecnologie_fermo (
    id      TEXT PRIMARY KEY,
    label   TEXT NOT NULL,
    prefissi TEXT NOT NULL DEFAULT '',   -- prefissi macchina separati da virgola, es. "DRA,SLW"
    colore  TEXT NOT NULL DEFAULT '#6B7280',
    ordine  INTEGER NOT NULL DEFAULT 0
);

-- Dati iniziali (migrazione da costanti statiche in FermiView)
INSERT INTO tecnologie_fermo (id, label, prefissi, colore, ordine) VALUES
    ('tornitura_soft', 'Tornitura Soft', 'DRA',         '#3B82F6', 1),
    ('dentatrici',     'Dentatrici',     'FRW,FRD',     '#F59E0B', 2),
    ('rettifiche denti',     'Rettifiche Denti',     'SLW',     '#8B5CF6', 3),
    ('stozzatrici',    'Stozzatrici',    'STW',         '#10B981', 4),
    ('saldatrici',     'Saldatrici',     'SCA',     '#EF4444', 5),
    ('smussatrici',    'Smussatrici',    'EGW',         '#6366F1', 6),
    ('tascatrice',    'Tascatrice',    'FRA',         '#6366F1', 6),
    ('altro',          'Altro',          '',            '#6B7280', 99)

ON CONFLICT (id) DO NOTHING;
