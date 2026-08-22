SELECT table_name,
       table_rows AS est_rows,
       ROUND(data_length / 1024 / 1024, 1) AS data_mb
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_type = 'BASE TABLE'
  AND (table_name LIKE 'lingxing\\_%' ESCAPE '\\'
       OR table_name LIKE 'operations_logistics\\_%' ESCAPE '\\')
ORDER BY table_name;
