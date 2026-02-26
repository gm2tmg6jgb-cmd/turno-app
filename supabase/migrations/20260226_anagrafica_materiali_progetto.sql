-- Aggiornamento Anagrafica Materiali
-- Aggiunta campo progetto per distinguere materiali dello stesso componente ma progetti diversi

ALTER TABLE anagrafica_materiali ADD COLUMN IF NOT EXISTS progetto TEXT;
