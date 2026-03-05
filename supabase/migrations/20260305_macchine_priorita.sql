CREATE TABLE IF NOT EXISTS public.macchine_priorita (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_label TEXT NOT NULL,
    section_color TEXT NOT NULL,
    machine_id TEXT NOT NULL UNIQUE,
    note TEXT,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.macchine_priorita ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.macchine_priorita FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.macchine_priorita FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.macchine_priorita FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON public.macchine_priorita FOR DELETE USING (true);

-- Crea la funzione se non esiste (o la rimpiazza se c'è già)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_macchine_priorita_updated_at ON public.macchine_priorita;
CREATE TRIGGER update_macchine_priorita_updated_at
    BEFORE UPDATE ON public.macchine_priorita
    FOR EACH ROW
    EXECUTE PROCEDURE public.update_updated_at_column();
