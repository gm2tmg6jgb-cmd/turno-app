-- Migration: Create componente_avanzamento table
-- Applied: 2026-06-09
-- Purpose: Track production progress and component advancement through phases

CREATE TABLE IF NOT EXISTS componente_avanzamento (
  id BIGSERIAL PRIMARY KEY,
  progetto TEXT NOT NULL,
  componente TEXT NOT NULL,
  fase_id TEXT NOT NULL,
  fase_label TEXT NOT NULL,
  pezzi_totali INTEGER NOT NULL DEFAULT 1200,
  pezzi_prodotti INTEGER NOT NULL DEFAULT 0,
  data_inizio TIMESTAMP WITH TIME ZONE,
  data_fine_prevista TIMESTAMP WITH TIME ZONE,
  data_fine_effettiva TIMESTAMP WITH TIME ZONE,
  stato TEXT NOT NULL DEFAULT 'in_progress', -- 'pending', 'in_progress', 'completed'
  percentuale_avanzamento NUMERIC DEFAULT 0,
  urgency_delta NUMERIC DEFAULT 0, -- differenza percentuale rispetto target
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(progetto, componente, fase_id)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_componente_avanzamento_progetto_componente
ON componente_avanzamento(progetto, componente);

CREATE INDEX IF NOT EXISTS idx_componente_avanzamento_stato
ON componente_avanzamento(stato);

CREATE INDEX IF NOT EXISTS idx_componente_avanzamento_updated
ON componente_avanzamento(updated_at DESC);

-- Enable RLS
ALTER TABLE componente_avanzamento ENABLE ROW LEVEL SECURITY;

-- Public read policy (authenticated users)
CREATE POLICY componente_avanzamento_read ON componente_avanzamento
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Write policy (authenticated users)
CREATE POLICY componente_avanzamento_write ON componente_avanzamento
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY componente_avanzamento_update ON componente_avanzamento
  FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Insert initial avanzamento data (example: current production status as of 2026-06-09)
-- DCT300 - SG5
INSERT INTO componente_avanzamento (progetto, componente, fase_id, fase_label, pezzi_totali, pezzi_prodotti, stato, percentuale_avanzamento, urgency_delta, data_inizio, data_fine_prevista, note)
VALUES
  ('DCT300', 'SG5', 'laser_welding', 'Saldatura Soft', 1200, 1200, 'completed', 100, 0, '2026-06-03'::timestamp, '2026-06-04'::timestamp, 'Completato'),
  ('DCT300', 'SG5', 'hobbing', 'Dentatura', 1200, 1200, 'completed', 100, 0, '2026-06-04'::timestamp, '2026-06-06'::timestamp, 'Completato'),
  ('DCT300', 'SG5', 'ht', 'Trattamento Termico', 1200, 996, 'in_progress', 83, -17, '2026-06-06'::timestamp, '2026-06-09'::timestamp, 'In forno - critico'),
  ('DCT300', 'SG5', 'start_hard', 'Tornitura Hard', 1200, 0, 'pending', 0, -17, '2026-06-09'::timestamp, '2026-06-11'::timestamp, 'In attesa fine forno'),
  ('DCT300', 'SG5', 'teeth_grinding', 'Rettifica Denti', 1200, 0, 'pending', 0, -17, '2026-06-11'::timestamp, '2026-06-12'::timestamp, 'In attesa tornitura hard'),

  -- 8Fe - FG5/7 (CRITICA - massima urgency)
  ('8Fe', 'FG5/7', 'laser_welding', 'Saldatura Soft', 1200, 1100, 'in_progress', 92, 0, '2026-05-28'::timestamp, '2026-06-02'::timestamp, 'Quasi completato'),
  ('8Fe', 'FG5/7', 'hobbing', 'Dentatura', 1200, 800, 'in_progress', 67, -34, '2026-06-01'::timestamp, '2026-06-04'::timestamp, 'CRITICA - 34% indietro'),
  ('8Fe', 'FG5/7', 'ht', 'Trattamento Termico', 1200, 0, 'pending', 0, -34, '2026-06-04'::timestamp, '2026-06-10'::timestamp, 'In coda per il forno'),
  ('8Fe', 'FG5/7', 'start_hard', 'Tornitura Hard', 1200, 0, 'pending', 0, -34, '2026-06-10'::timestamp, '2026-06-12'::timestamp, 'In attesa completamento soft'),
  ('8Fe', 'FG5/7', 'teeth_grinding', 'Rettifica Denti', 1200, 0, 'pending', 0, -34, '2026-06-12'::timestamp, '2026-06-14'::timestamp, 'Fase critica - setup specializzato'),

  -- DCT ECO - SG2
  ('DCT ECO', 'SG2', 'laser_welding', 'Saldatura Soft', 1200, 1200, 'completed', 100, 0, '2026-06-05'::timestamp, '2026-06-06'::timestamp, 'Completato'),
  ('DCT ECO', 'SG2', 'hobbing', 'Dentatura', 1200, 1150, 'in_progress', 96, 2, '2026-06-06'::timestamp, '2026-06-08'::timestamp, 'On track'),
  ('DCT ECO', 'SG2', 'ht', 'Trattamento Termico', 1200, 0, 'pending', 0, 2, '2026-06-08'::timestamp, '2026-06-11'::timestamp, 'In attesa in coda'),
  ('DCT ECO', 'SG2', 'start_hard', 'Tornitura Hard', 1200, 0, 'pending', 0, 2, '2026-06-11'::timestamp, '2026-06-13'::timestamp, 'Previsto'),
  ('DCT ECO', 'SG2', 'teeth_grinding', 'Rettifica Denti', 1200, 0, 'pending', 0, 2, '2026-06-13'::timestamp, '2026-06-14'::timestamp, 'Previsto')
ON CONFLICT (progetto, componente, fase_id) DO NOTHING;

-- Create a view for easier agent queries
CREATE OR REPLACE VIEW v_componente_avanzamento_summary AS
SELECT
  progetto,
  componente,
  COUNT(*) as total_fasi,
  SUM(CASE WHEN stato = 'completed' THEN 1 ELSE 0 END) as fasi_completate,
  SUM(CASE WHEN stato = 'in_progress' THEN 1 ELSE 0 END) as fasi_in_progress,
  SUM(CASE WHEN stato = 'pending' THEN 1 ELSE 0 END) as fasi_pending,
  ROUND(AVG(percentuale_avanzamento), 2) as percentuale_media,
  ROUND(AVG(urgency_delta), 2) as urgency_delta_media,
  MAX(CASE WHEN stato = 'in_progress' THEN fase_label ELSE NULL END) as fase_attuale,
  MAX(CASE WHEN stato = 'in_progress' THEN percentuale_avanzamento ELSE 0 END) as progresso_fase_attuale
FROM componente_avanzamento
GROUP BY progetto, componente
ORDER BY urgency_delta_media DESC, componente;
