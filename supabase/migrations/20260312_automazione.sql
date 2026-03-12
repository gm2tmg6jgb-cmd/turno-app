-- Add automazione column to macchine
ALTER TABLE public.macchine ADD COLUMN IF NOT EXISTS automazione TEXT;

-- Add is_automazione flag to fermi_macchina to distinguish automation downtimes
ALTER TABLE public.fermi_macchina ADD COLUMN IF NOT EXISTS is_automazione BOOLEAN DEFAULT FALSE;

-- Update RLS if needed (usually columns are covered by table-level RLS, but just in case)
-- No special RLS changes needed for simple column additions.
