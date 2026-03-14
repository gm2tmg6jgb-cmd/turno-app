-- Delete machines DRA11037 and DRA10115 from the system
DELETE FROM macchine WHERE id IN ('DRA11037', 'DRA10115');
