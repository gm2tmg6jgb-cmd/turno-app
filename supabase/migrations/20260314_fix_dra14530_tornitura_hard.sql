-- Assicura che la tecnologia tornitura_hard esista
INSERT INTO tecnologie_fermo (id, label, prefissi, colore, ordine)
VALUES ('tornitura_hard', 'Tornitura Hard', '', '#EF4444', 2)
ON CONFLICT (id) DO NOTHING;

-- Imposta DRA14530 come macchina di Tornitura Hard (codice_sap di DRA10099/DRA10100)
UPDATE macchine
SET tecnologia_id = 'tornitura_hard'
WHERE codice_sap = 'DRA14530';

-- Aggiunge DRA14530 come torno hard nel process flow (override del prefisso DRA → start_soft)
INSERT INTO wc_fasi_mapping (work_center, fase, match_type)
VALUES ('DRA14530', 'start_hard', 'exact')
ON CONFLICT DO NOTHING;
