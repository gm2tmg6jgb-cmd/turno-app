-- Tabella anagrafica motivi fermo macchina
CREATE TABLE IF NOT EXISTS motivi_fermo (
    id     TEXT PRIMARY KEY,
    label  TEXT NOT NULL,
    colore TEXT NOT NULL DEFAULT '#6B7280',
    icona  TEXT NOT NULL DEFAULT '📝'
);

-- Dati iniziali (migrazione da costanti statiche)
INSERT INTO motivi_fermo (id, label, colore, icona) VALUES
    ('guasto_meccanico',   'Guasto Meccanico',   '#EF4444', '🔧'),
    ('guasto_elettrico',   'Guasto Elettrico',   '#F59E0B', '⚡'),
    ('mancanza_materiale', 'Mancanza Materiale', '#3B82F6', '📦'),
    ('attrezzaggio',       'Attrezzaggio',       '#6366F1', '⚙️'),
    ('manutenzione',       'Manutenzione',       '#10B981', '🧹'),
    ('pausa',              'Pausa / Riunione',   '#6B7280', '☕'),
    ('altro',              'Altro',              '#9CA3AF', '📝')
ON CONFLICT (id) DO NOTHING;
