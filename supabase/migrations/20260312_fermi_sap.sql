-- Tabella per importazione fermi macchina da SAP
CREATE TABLE IF NOT EXISTS public.fermi_sap (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    macchina_id TEXT REFERENCES public.macchine(id) ON DELETE SET NULL,
    work_center_sap TEXT,
    data_inizio DATE,
    ora_inizio TIME,
    data_fine DATE,
    ora_fine TIME,
    durata_minuti INTEGER,
    codice_fermo TEXT,
    descrizione_fermo TEXT,
    oggetto_tecnico TEXT,
    autore TEXT,
    turno_id TEXT, -- mappato a A/B/C/D
    data_import TIMESTAMPTZ DEFAULT NOW()
);

-- Assicurati che le colonne extra esistano se la tabella è già stata creata in precedenza
ALTER TABLE public.fermi_sap ADD COLUMN IF NOT EXISTS oggetto_tecnico TEXT;
ALTER TABLE public.fermi_sap ADD COLUMN IF NOT EXISTS autore TEXT;

-- Enable RLS
ALTER TABLE public.fermi_sap ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "Allow all" ON public.fermi_sap; -- Uncomment if you need to recreate
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'fermi_sap' AND policyname = 'Allow all') THEN
        CREATE POLICY "Allow all" ON public.fermi_sap FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_fermi_sap_data ON public.fermi_sap(data_inizio);
CREATE INDEX IF NOT EXISTS idx_fermi_sap_macchina ON public.fermi_sap(macchina_id);
