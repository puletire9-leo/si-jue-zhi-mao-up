-- 八爪鱼导入幂等元数据。NULL 批次号保留给历史任务，MySQL 唯一索引允许多行 NULL。
SET @db := DATABASE();

SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE asin_import_tasks ADD COLUMN bazhuayu_batch_no VARCHAR(32) NULL COMMENT ''八爪鱼批次号'' AFTER bazhuayu_task_id, ADD COLUMN bazhuayu_batch_start_time DATETIME(3) NULL COMMENT ''批次开始时间'' AFTER bazhuayu_batch_no, ADD COLUMN bazhuayu_batch_end_time DATETIME(3) NULL COMMENT ''批次结束时间'' AFTER bazhuayu_batch_start_time, ADD COLUMN bazhuayu_batch_count INT NULL COMMENT ''云端批次数量'' AFTER bazhuayu_batch_end_time, ADD COLUMN bazhuayu_lot_no VARCHAR(64) NULL COMMENT ''八爪鱼 lotNo'' AFTER bazhuayu_batch_count',
    'SELECT ''bazhuayu batch columns already exist''')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=@db AND TABLE_NAME='asin_import_tasks' AND COLUMN_NAME='bazhuayu_batch_no'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE asin_import_tasks ADD UNIQUE KEY uk_bazhuayu_mapping_batch (bazhuayu_mapping_id, bazhuayu_batch_no)',
    'SELECT ''bazhuayu batch idempotency index already exists''')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA=@db AND TABLE_NAME='asin_import_tasks' AND INDEX_NAME='uk_bazhuayu_mapping_batch'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
