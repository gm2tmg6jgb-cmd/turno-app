-- Create table for dynamic process flow slots
CREATE TABLE IF NOT EXISTS macchine_workflow_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    macchina_id TEXT NOT NULL REFERENCES macchine(id) ON DELETE CASCADE,
    ordine INTEGER NOT NULL,
    label TEXT DEFAULT 'Slot',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for better performance when fetching slots per machine
CREATE INDEX IF NOT EXISTS idx_workflow_slots_macchina_id ON macchine_workflow_slots(macchina_id);
CREATE INDEX IF NOT EXISTS idx_workflow_slots_ordine ON macchine_workflow_slots(ordine);
