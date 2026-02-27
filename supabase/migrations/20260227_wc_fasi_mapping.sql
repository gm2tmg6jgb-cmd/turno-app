-- Tabella per mappare centri di lavoro SAP alle fasi di produzione
-- match_type: 'exact' = codice esatto | 'prefix' = inizia con...
CREATE TABLE IF NOT EXISTS wc_fasi_mapping (
    id SERIAL PRIMARY KEY,
    work_center TEXT NOT NULL,
    fase TEXT NOT NULL,        -- start_soft | end_soft | ht | start_hard | end_hard | washing
    match_type TEXT NOT NULL DEFAULT 'prefix'  -- 'exact' | 'prefix'
);

-- Popolamento iniziale con le mappature già note
INSERT INTO wc_fasi_mapping (work_center, fase, match_type) VALUES
    ('SCA14025', 'start_soft', 'exact'),
    ('FRW',      'end_soft',   'prefix'),
    ('FRD',      'end_soft',   'prefix'),
    ('STW',      'end_soft',   'prefix'),
    ('SLW',      'end_hard',   'prefix'),
    ('SLA',      'end_hard',   'prefix')
ON CONFLICT DO NOTHING;
