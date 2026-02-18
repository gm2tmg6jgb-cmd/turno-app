-- Migration: Create fermi_macchina and pezzi_prodotti tables
-- Run this in Supabase SQL Editor

-- Table: fermi_macchina
-- Tracks machine stops/downtime per shift
CREATE TABLE IF NOT EXISTS public.fermi_macchina (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    macchina_id TEXT NOT NULL REFERENCES public.macchine(id) ON DELETE CASCADE,
    data DATE NOT NULL,
    turno_id TEXT NOT NULL,
    ora_inizio TIME,
    ora_fine TIME,
    durata_minuti INTEGER, -- calculated or manually entered
    motivo TEXT NOT NULL, -- e.g. 'guasto', 'manutenzione', 'setup', 'attesa_materiale', 'altro'
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.fermi_macchina ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON public.fermi_macchina FOR ALL USING (true) WITH CHECK (true);

-- Table: pezzi_prodotti
-- Tracks production count per machine per shift
CREATE TABLE IF NOT EXISTS public.pezzi_prodotti (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    macchina_id TEXT NOT NULL REFERENCES public.macchine(id) ON DELETE CASCADE,
    data DATE NOT NULL,
    turno_id TEXT NOT NULL,
    quantita INTEGER NOT NULL DEFAULT 0,
    scarti INTEGER DEFAULT 0,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(macchina_id, data, turno_id) -- One record per machine per shift per day
);

-- Enable RLS
ALTER TABLE public.pezzi_prodotti ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON public.pezzi_prodotti FOR ALL USING (true) WITH CHECK (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_fermi_macchina_data ON public.fermi_macchina(data, turno_id);
CREATE INDEX IF NOT EXISTS idx_fermi_macchina_macchina ON public.fermi_macchina(macchina_id);
CREATE INDEX IF NOT EXISTS idx_pezzi_prodotti_data ON public.pezzi_prodotti(data, turno_id);
CREATE INDEX IF NOT EXISTS idx_pezzi_prodotti_macchina ON public.pezzi_prodotti(macchina_id);
