-- 八爪鱼导入断点续传检查点：已处理的云端原始行 offset。
-- 暂停(PAUSED)时落盘，resume 时从此 offset 续拉，避免重拉已导行 / 重复写 asin_import_results。
-- 幂等：列已存在则跳过。
SET @db := DATABASE();

SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE asin_import_tasks ADD COLUMN resume_offset INT NULL COMMENT ''八爪鱼导入断点：已处理云端原始行 offset'' AFTER progress_log',
    'SELECT ''resume_offset column already exists''')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=@db AND TABLE_NAME='asin_import_tasks' AND COLUMN_NAME='resume_offset'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
