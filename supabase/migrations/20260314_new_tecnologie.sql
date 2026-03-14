-- Add new technology categories for RG and DH areas
INSERT INTO tecnologie_fermo (id, label, prefissi, colore, ordine) VALUES
    ('rg_loop_grande', 'RG Loop Grande', '', '#10B981', 20),
    ('rg_mini_opf',    'RG Mini OPF',    '', '#10B981', 21),
    ('dh_machining',   'DH Machining',   '', '#3B82F6', 30),
    ('dh_assembly',    'DH Assembly',    '', '#3B82F6', 31),
    ('dh_laser_welding', 'DH Laser Welding', '', '#EF4444', 32)
ON CONFLICT (id) DO UPDATE SET 
    label = EXCLUDED.label,
    ordine = EXCLUDED.ordine;
