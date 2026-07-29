-- 任务真实完成时间。仅在任务进入终态(READY/DONE/ERROR/REJECTED/CANCELLED)时写入，
-- 与 updated_at(每次更新都变)区分，避免 overview 把进度更新时间误当成完成时间。
SET @db := DATABASE();

SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE asin_import_tasks ADD COLUMN completed_at DATETIME NULL COMMENT ''任务终态完成时间'' AFTER updated_at',
    'SELECT ''completed_at column already exists''')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=@db AND TABLE_NAME='asin_import_tasks' AND COLUMN_NAME='completed_at'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
