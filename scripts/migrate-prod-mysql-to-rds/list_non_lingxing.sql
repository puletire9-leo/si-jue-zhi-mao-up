SELECT table_name,
       table_rows,
       ROUND(data_length / 1024 / 1024, 1) AS data_mb
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_type = 'BASE TABLE'
  AND table_name NOT LIKE 'lingxing\\_%' ESCAPE '\\'
ORDER BY table_name;
