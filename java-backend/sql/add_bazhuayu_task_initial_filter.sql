-- Existing installations may already have bazhuayu_task_mapping.
SET @has_initial_filter = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'bazhuayu_task_mapping'
      AND COLUMN_NAME = 'initial_filter'
);
SET @sql = IF(
    @has_initial_filter = 0,
    'ALTER TABLE bazhuayu_task_mapping ADD COLUMN initial_filter TINYINT(1) NOT NULL DEFAULT 1 AFTER primary_task',
    'SELECT ''bazhuayu_task_mapping.initial_filter exists'''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Existing named boutique tasks must bypass the legacy initial-screen pipeline.
UPDATE bazhuayu_task_mapping
SET initial_filter = 0
WHERE function_key = 'bangdan'
  AND task_name LIKE '%精品%';
