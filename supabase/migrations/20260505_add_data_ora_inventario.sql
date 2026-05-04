-- Add data_ora_inventario column to inventario_fisico table
-- This timestamp marks when the physical inventory started and is used to filter SAP data (confirme_sap, MB51)

ALTER TABLE inventario_fisico ADD COLUMN IF NOT EXISTS data_ora_inventario TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create index for faster filtering when querying by this timestamp
CREATE INDEX IF NOT EXISTS idx_inventario_fisico_data_ora ON inventario_fisico (data_ora_inventario);
