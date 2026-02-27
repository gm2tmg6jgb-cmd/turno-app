-- Tabella per salvare la situazione di asservimento OP10 (WEISSER e ECO)
CREATE TABLE IF NOT EXISTS asservimento_op10 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data DATE NOT NULL,
    turno TEXT NOT NULL,
    weisser_data JSONB NOT NULL,
    eco_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(data, turno)
);

-- Abilita RLS
ALTER TABLE asservimento_op10 ENABLE ROW LEVEL SECURITY;

-- Policy per accesso pubblico (in lettura e scrittura come richiesto dall'attuale configurazione dell'app)
CREATE POLICY "Accesso totale per tutti" ON asservimento_op10 FOR ALL USING (true) WITH CHECK (true);
