-- Tabella per configurazione slot nel Report Flusso di Processo
CREATE TABLE IF NOT EXISTS slot_config (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  macchina_id text NOT NULL,
  slot_index integer NOT NULL CHECK (slot_index >= 0 AND slot_index <= 2),
  componente text,
  progetto text,
  sap_work_center text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (macchina_id, slot_index)
);

-- Trigger per aggiornare updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER slot_config_updated_at
  BEFORE UPDATE ON slot_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
