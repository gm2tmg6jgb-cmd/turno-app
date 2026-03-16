-- Aggiunge array di macchine a lavorazioni (supporto gemellari)
ALTER TABLE lavorazioni ADD COLUMN IF NOT EXISTS macchine_ids TEXT[] DEFAULT '{}';

-- Assicura permessi corretti
GRANT ALL ON TABLE lavorazioni TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE lavorazioni_id_seq TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
