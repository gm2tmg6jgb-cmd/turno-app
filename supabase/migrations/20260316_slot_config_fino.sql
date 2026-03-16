-- Add fino (operation number) to slot_config, replacing sap_work_center
ALTER TABLE slot_config ADD COLUMN IF NOT EXISTS fino TEXT;

NOTIFY pgrst, 'reload schema';
