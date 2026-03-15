-- Add is_automazione column to motivi_fermo
ALTER TABLE motivi_fermo ADD COLUMN IF NOT EXISTS is_automazione BOOLEAN DEFAULT FALSE;

-- Insert common automation reasons
INSERT INTO motivi_fermo (label, is_automazione, tecnologia_id) VALUES
('Malfunzionamento Robot', TRUE, 'automazione'),
('Nastro Trasportatore Bloccato', TRUE, 'automazione'),
('Sensore Pinza NOK', TRUE, 'automazione'),
('Errore PLC Gruppo Automazione', TRUE, 'automazione'),
('Allineamento Pezzo in Carico NOK', TRUE, 'automazione');
