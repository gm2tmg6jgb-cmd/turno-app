-- Migration: Create componente_fasi table for component-specific phase configuration
-- Applied: 2026-04-29
-- Purpose: Store phase information per component, replacing hardcoded STD_PHASES

CREATE TABLE IF NOT EXISTS componente_fasi (
  id BIGSERIAL PRIMARY KEY,
  progetto TEXT NOT NULL,
  componente TEXT NOT NULL,
  fase_id TEXT NOT NULL,
  fase_label TEXT NOT NULL,
  pzH NUMERIC,
  fixedH NUMERIC,
  chargeSize INTEGER,
  noChangeOver BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(progetto, componente, fase_id)
);

-- Create index for fast lookups by progetto+componente
CREATE INDEX IF NOT EXISTS idx_componente_fasi_progetto_componente
ON componente_fasi(progetto, componente);

-- Enable RLS
ALTER TABLE componente_fasi ENABLE ROW LEVEL SECURITY;

-- Public read policy (authenticated users)
CREATE POLICY componente_fasi_read ON componente_fasi
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Admin write policy
CREATE POLICY componente_fasi_write ON componente_fasi
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY componente_fasi_update ON componente_fasi
  FOR UPDATE
  USING (auth.role() = 'authenticated' AND EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- Insert default phases (based on current STD_PHASES)
-- All components currently use the same phases, but this allows per-component customization
INSERT INTO componente_fasi (progetto, componente, fase_id, fase_label, pzH, fixedH, chargeSize, noChangeOver)
SELECT
  proj,
  comp,
  'laser_welding'::text,
  'Saldatura Soft'::text,
  130::numeric,
  NULL,
  NULL,
  false
FROM (
  SELECT DISTINCT progetto as proj, componente as comp
  FROM (
    VALUES
      ('DCT300', 'SG1'), ('DCT300', 'DG-REV'), ('DCT300', 'DG'), ('DCT300', 'SG3'), ('DCT300', 'SG4'),
      ('DCT300', 'SG5'), ('DCT300', 'SG6'), ('DCT300', 'SG7'), ('DCT300', 'SGR'), ('DCT300', 'RG'),
      ('8Fe', 'SG2'), ('8Fe', 'SG3'), ('8Fe', 'SG4'), ('8Fe', 'SG5'), ('8Fe', 'SG6'),
      ('8Fe', 'SG7'), ('8Fe', 'SG8'), ('8Fe', 'SGR'), ('8Fe', 'PG'), ('8Fe', 'FG5/7'),
      ('DCT ECO', 'SG2'), ('DCT ECO', 'SG3'), ('DCT ECO', 'SG4'), ('DCT ECO', 'SG5'), ('DCT ECO', 'SGR'),
      ('DCT ECO', 'RG FD1'), ('DCT ECO', 'RG FD2'), ('RG+DH', 'RG FD1'), ('RG+DH', 'RG FD2')
  ) AS t(progetto, componente)
) t2
ON CONFLICT (progetto, componente, fase_id) DO NOTHING;

-- Continue with remaining phases...
INSERT INTO componente_fasi (progetto, componente, fase_id, fase_label, pzH, fixedH, chargeSize, noChangeOver)
SELECT
  proj,
  comp,
  'hobbing'::text,
  'Dentatura'::text,
  86::numeric,
  NULL,
  NULL,
  false
FROM (
  SELECT DISTINCT progetto as proj, componente as comp
  FROM (
    VALUES
      ('DCT300', 'SG1'), ('DCT300', 'DG-REV'), ('DCT300', 'DG'), ('DCT300', 'SG3'), ('DCT300', 'SG4'),
      ('DCT300', 'SG5'), ('DCT300', 'SG6'), ('DCT300', 'SG7'), ('DCT300', 'SGR'), ('DCT300', 'RG'),
      ('8Fe', 'SG2'), ('8Fe', 'SG3'), ('8Fe', 'SG4'), ('8Fe', 'SG5'), ('8Fe', 'SG6'),
      ('8Fe', 'SG7'), ('8Fe', 'SG8'), ('8Fe', 'SGR'), ('8Fe', 'PG'), ('8Fe', 'FG5/7'),
      ('DCT ECO', 'SG2'), ('DCT ECO', 'SG3'), ('DCT ECO', 'SG4'), ('DCT ECO', 'SG5'), ('DCT ECO', 'SGR'),
      ('DCT ECO', 'RG FD1'), ('DCT ECO', 'RG FD2'), ('RG+DH', 'RG FD1'), ('RG+DH', 'RG FD2')
  ) AS t(progetto, componente)
) t2
ON CONFLICT (progetto, componente, fase_id) DO NOTHING;

INSERT INTO componente_fasi (progetto, componente, fase_id, fase_label, pzH, fixedH, chargeSize, noChangeOver)
SELECT
  proj,
  comp,
  'ht'::text,
  'Tratt. Termico'::text,
  NULL,
  8::numeric,
  176::integer,
  true
FROM (
  SELECT DISTINCT progetto as proj, componente as comp
  FROM (
    VALUES
      ('DCT300', 'SG1'), ('DCT300', 'DG-REV'), ('DCT300', 'DG'), ('DCT300', 'SG3'), ('DCT300', 'SG4'),
      ('DCT300', 'SG5'), ('DCT300', 'SG6'), ('DCT300', 'SG7'), ('DCT300', 'SGR'), ('DCT300', 'RG'),
      ('8Fe', 'SG2'), ('8Fe', 'SG3'), ('8Fe', 'SG4'), ('8Fe', 'SG5'), ('8Fe', 'SG6'),
      ('8Fe', 'SG7'), ('8Fe', 'SG8'), ('8Fe', 'SGR'), ('8Fe', 'PG'), ('8Fe', 'FG5/7'),
      ('DCT ECO', 'SG2'), ('DCT ECO', 'SG3'), ('DCT ECO', 'SG4'), ('DCT ECO', 'SG5'), ('DCT ECO', 'SGR'),
      ('DCT ECO', 'RG FD1'), ('DCT ECO', 'RG FD2'), ('RG+DH', 'RG FD1'), ('RG+DH', 'RG FD2')
  ) AS t(progetto, componente)
) t2
ON CONFLICT (progetto, componente, fase_id) DO NOTHING;

INSERT INTO componente_fasi (progetto, componente, fase_id, fase_label, pzH, fixedH, chargeSize, noChangeOver)
SELECT
  proj,
  comp,
  'start_hard'::text,
  'Tornitura Hard'::text,
  104::numeric,
  NULL,
  NULL,
  false
FROM (
  SELECT DISTINCT progetto as proj, componente as comp
  FROM (
    VALUES
      ('DCT300', 'SG1'), ('DCT300', 'DG-REV'), ('DCT300', 'DG'), ('DCT300', 'SG3'), ('DCT300', 'SG4'),
      ('DCT300', 'SG5'), ('DCT300', 'SG6'), ('DCT300', 'SG7'), ('DCT300', 'SGR'), ('DCT300', 'RG'),
      ('8Fe', 'SG2'), ('8Fe', 'SG3'), ('8Fe', 'SG4'), ('8Fe', 'SG5'), ('8Fe', 'SG6'),
      ('8Fe', 'SG7'), ('8Fe', 'SG8'), ('8Fe', 'SGR'), ('8Fe', 'PG'), ('8Fe', 'FG5/7'),
      ('DCT ECO', 'SG2'), ('DCT ECO', 'SG3'), ('DCT ECO', 'SG4'), ('DCT ECO', 'SG5'), ('DCT ECO', 'SGR'),
      ('DCT ECO', 'RG FD1'), ('DCT ECO', 'RG FD2'), ('RG+DH', 'RG FD1'), ('RG+DH', 'RG FD2')
  ) AS t(progetto, componente)
) t2
ON CONFLICT (progetto, componente, fase_id) DO NOTHING;

INSERT INTO componente_fasi (progetto, componente, fase_id, fase_label, pzH, fixedH, chargeSize, noChangeOver)
SELECT
  proj,
  comp,
  'teeth_grinding'::text,
  'Rettifica Denti'::text,
  100::numeric,
  NULL,
  NULL,
  false
FROM (
  SELECT DISTINCT progetto as proj, componente as comp
  FROM (
    VALUES
      ('DCT300', 'SG1'), ('DCT300', 'DG-REV'), ('DCT300', 'DG'), ('DCT300', 'SG3'), ('DCT300', 'SG4'),
      ('DCT300', 'SG5'), ('DCT300', 'SG6'), ('DCT300', 'SG7'), ('DCT300', 'SGR'), ('DCT300', 'RG'),
      ('8Fe', 'SG2'), ('8Fe', 'SG3'), ('8Fe', 'SG4'), ('8Fe', 'SG5'), ('8Fe', 'SG6'),
      ('8Fe', 'SG7'), ('8Fe', 'SG8'), ('8Fe', 'SGR'), ('8Fe', 'PG'), ('8Fe', 'FG5/7'),
      ('DCT ECO', 'SG2'), ('DCT ECO', 'SG3'), ('DCT ECO', 'SG4'), ('DCT ECO', 'SG5'), ('DCT ECO', 'SGR'),
      ('DCT ECO', 'RG FD1'), ('DCT ECO', 'RG FD2'), ('RG+DH', 'RG FD1'), ('RG+DH', 'RG FD2')
  ) AS t(progetto, componente)
) t2
ON CONFLICT (progetto, componente, fase_id) DO NOTHING;
