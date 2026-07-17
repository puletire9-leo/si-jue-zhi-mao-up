-- 八爪鱼命名任务增加业务分类；primary_task 仅保留兼容，不再参与业务判断。
SET @has_task_category = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'bazhuayu_task_mapping'
      AND COLUMN_NAME = 'task_category'
);
SET @sql = IF(
    @has_task_category = 0,
    'ALTER TABLE bazhuayu_task_mapping ADD COLUMN task_category VARCHAR(32) NOT NULL DEFAULT ''DEFAULT'' AFTER task_name',
    'SELECT ''bazhuayu_task_mapping.task_category exists'''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE bazhuayu_task_mapping
SET task_category = CASE
    WHEN function_key = 'yitushitu' THEN CONVERT(0xe4bba5e59bbee8af86e59bbe USING utf8mb4)
    WHEN initial_filter = 0 THEN CONVERT(0xe7b2bee59381 USING utf8mb4)
    ELSE CONVERT(0xe7b2bee993ba USING utf8mb4)
END;

-- 每个任务平级；旧字段统一置 1 只为兼容历史 SQL，代码不再读取。
UPDATE bazhuayu_task_mapping SET primary_task = 1;

SET @has_import_metadata = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'asin_import_tasks'
      AND COLUMN_NAME = 'bazhuayu_mapping_id'
);
SET @sql = IF(
    @has_import_metadata = 0,
    'ALTER TABLE asin_import_tasks
        ADD COLUMN bazhuayu_mapping_id BIGINT NULL AFTER data_month,
        ADD COLUMN bazhuayu_task_id VARCHAR(64) NULL AFTER bazhuayu_mapping_id,
        ADD COLUMN task_name VARCHAR(60) NULL AFTER bazhuayu_task_id,
        ADD COLUMN task_category VARCHAR(32) NULL AFTER task_name,
        ADD COLUMN initial_filter TINYINT(1) NOT NULL DEFAULT 1 AFTER task_category,
        ADD COLUMN target_table VARCHAR(32) NOT NULL DEFAULT ''competitor_products'' AFTER initial_filter,
        ADD KEY idx_asin_import_bazhuayu_mapping (bazhuayu_mapping_id, created_at)',
    'SELECT ''asin_import_tasks bazhuayu metadata exists'''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
