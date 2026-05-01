-- Create richiami table for disciplinary warnings tracking
CREATE TABLE IF NOT EXISTS richiami (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dipendente_id TEXT NOT NULL REFERENCES dipendenti(id) ON DELETE CASCADE,
  data_richiamo DATE NOT NULL,
  motivo TEXT NOT NULL,
  descrizione TEXT,
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_richiami_dipendente
  ON richiami(dipendente_id);

CREATE INDEX IF NOT EXISTS idx_richiami_data
  ON richiami(data_richiamo);

CREATE INDEX IF NOT EXISTS idx_richiami_deleted
  ON richiami(deleted_at);

-- Enable RLS (Row Level Security)
ALTER TABLE richiami ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations
CREATE POLICY "Allow all operations on richiami"
  ON richiami
  FOR ALL
  USING (true)
  WITH CHECK (true);
