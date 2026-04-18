-- Create production_deadlines table for deadline and priority tracking
CREATE TABLE production_deadlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  progetto TEXT NOT NULL,
  componente TEXT NOT NULL,
  quantita_target INTEGER NOT NULL,
  deadline_date DATE NOT NULL,
  data_inizio DATE,
  priorita_override INTEGER,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(progetto, componente, deadline_date)
);

-- Create component_delay_logs table for historical tracking (optional)
CREATE TABLE component_delay_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  componente TEXT NOT NULL,
  progetto TEXT NOT NULL,
  deadline_date DATE,
  quantita_target INTEGER,
  quantita_effettiva INTEGER,
  quantita_mancante INTEGER,
  giorni_residui INTEGER,
  slack_giorni NUMERIC,
  status TEXT,
  data_log DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_production_deadlines_deadline
  ON production_deadlines(deadline_date);

CREATE INDEX idx_production_deadlines_progetto
  ON production_deadlines(progetto);

CREATE INDEX idx_production_deadlines_componente
  ON production_deadlines(progetto, componente);

CREATE INDEX idx_component_delay_logs_date
  ON component_delay_logs(data_log);

CREATE INDEX idx_component_delay_logs_componente
  ON component_delay_logs(progetto, componente);

-- Enable RLS (Row Level Security)
ALTER TABLE production_deadlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE component_delay_logs ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations (can restrict later if needed)
CREATE POLICY "Allow all operations on production_deadlines"
  ON production_deadlines
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on component_delay_logs"
  ON component_delay_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);
