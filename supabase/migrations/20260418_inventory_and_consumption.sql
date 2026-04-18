-- Create component_inventory table for tracking available inventory
CREATE TABLE component_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  componente TEXT NOT NULL,
  progetto TEXT NOT NULL,
  linea TEXT NOT NULL,           -- L1, L2, L3
  qty_disponibile INTEGER NOT NULL DEFAULT 0,
  data_aggiornamento TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(componente, progetto, linea)
);

-- Create component_consumption table for hourly consumption configuration
CREATE TABLE component_consumption (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  componente TEXT NOT NULL,
  progetto TEXT NOT NULL,
  linea TEXT NOT NULL,           -- L1, L2, L3
  pz_per_ora DECIMAL(10, 2) NOT NULL DEFAULT 0,
  tempo_ciclo_minuti DECIMAL(10, 2),
  nota TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(componente, progetto, linea)
);

-- Create indexes for performance
CREATE INDEX idx_component_inventory_componente
  ON component_inventory(componente);

CREATE INDEX idx_component_inventory_progetto
  ON component_inventory(progetto);

CREATE INDEX idx_component_inventory_linea
  ON component_inventory(linea);

CREATE INDEX idx_component_consumption_componente
  ON component_consumption(componente);

CREATE INDEX idx_component_consumption_progetto
  ON component_consumption(progetto);

CREATE INDEX idx_component_consumption_linea
  ON component_consumption(linea);

-- Enable RLS (Row Level Security)
ALTER TABLE component_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE component_consumption ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations (can restrict later if needed)
CREATE POLICY "Allow all operations on component_inventory"
  ON component_inventory
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on component_consumption"
  ON component_consumption
  FOR ALL
  USING (true)
  WITH CHECK (true);
