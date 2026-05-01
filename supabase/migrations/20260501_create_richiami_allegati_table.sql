-- Create richiami_allegati table for attachments/documents related to warnings
CREATE TABLE IF NOT EXISTS richiami_allegati (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  richiamo_id UUID NOT NULL REFERENCES richiami(id) ON DELETE CASCADE,
  nome_file TEXT NOT NULL,
  url_file TEXT NOT NULL,
  tipo_file TEXT,
  dimensione BIGINT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_richiami_allegati_richiamo
  ON richiami_allegati(richiamo_id);

CREATE INDEX IF NOT EXISTS idx_richiami_allegati_uploaded
  ON richiami_allegati(uploaded_at);

-- Enable RLS (Row Level Security)
ALTER TABLE richiami_allegati ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations
CREATE POLICY "Allow all operations on richiami_allegati"
  ON richiami_allegati
  FOR ALL
  USING (true)
  WITH CHECK (true);
