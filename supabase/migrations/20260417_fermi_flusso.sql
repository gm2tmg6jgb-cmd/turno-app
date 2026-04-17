-- Table: fermi_flusso
-- Fermi registrati dalla vista Avanzamento Componenti, per cella (progetto + componente + fase)
CREATE TABLE IF NOT EXISTS public.fermi_flusso (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    progetto TEXT NOT NULL,
    componente TEXT,
    fase TEXT,
    data DATE NOT NULL,
    turno_id TEXT,
    macchina_id TEXT,
    motivo TEXT NOT NULL,
    durata_minuti INTEGER NOT NULL DEFAULT 0,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.fermi_flusso ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON public.fermi_flusso FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_fermi_flusso_data ON public.fermi_flusso(data, progetto);
CREATE INDEX IF NOT EXISTS idx_fermi_flusso_cell ON public.fermi_flusso(progetto, componente, fase, data);
