-- Aggiunta campi per il monte ore residuo (Ferie e ROL) alla tabella dipendenti
ALTER TABLE dipendenti ADD COLUMN IF NOT EXISTS ferie_residue numeric(10,2) DEFAULT 0;
ALTER TABLE dipendenti ADD COLUMN IF NOT EXISTS rol_residui numeric(10,2) DEFAULT 0;

-- Commenti per chiarezza
COMMENT ON COLUMN dipendenti.ferie_residue IS 'Monte ore ferie residue da pianificare';
COMMENT ON COLUMN dipendenti.rol_residui IS 'Monte ore ROL residui da pianificare';
