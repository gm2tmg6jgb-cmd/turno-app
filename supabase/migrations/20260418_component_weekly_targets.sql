-- Create component_weekly_targets table for weekly production targets
CREATE TABLE component_weekly_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  componente TEXT NOT NULL,
  progetto TEXT NOT NULL,
  linea TEXT NOT NULL,        -- L1, L2, L3
  week_start DATE NOT NULL,   -- Lunedì della settimana (identificatore univoco)
  target_qty INTEGER NOT NULL, -- Quantità target per questa settimana
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(componente, progetto, linea, week_start)
);

-- Create indexes for performance
CREATE INDEX idx_weekly_targets_week
  ON component_weekly_targets(week_start);

CREATE INDEX idx_weekly_targets_component
  ON component_weekly_targets(componente, progetto, linea);

-- Enable RLS (Row Level Security)
ALTER TABLE component_weekly_targets ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations
CREATE POLICY "Allow all operations on component_weekly_targets"
  ON component_weekly_targets
  FOR ALL
  USING (true)
  WITH CHECK (true);
