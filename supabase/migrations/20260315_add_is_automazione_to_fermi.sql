-- Add is_automazione column to fermi_macchina table
ALTER TABLE fermi_macchina ADD COLUMN IF NOT EXISTS is_automazione BOOLEAN DEFAULT FALSE;
