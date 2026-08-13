-- 把通过(pass_count)拆成两列，让「通过原因」能明确区分：
--   pass_refetch_count = 新品重取放行（已采过<30天，重新去卖家精灵取，会重复消耗 API）
--   pass_new_count     = 全新通过（从没见过的 ASIN）
-- 幂等：列已存在则跳过。pass_count 保留作汇总/旧数据兼容。
SET @db := DATABASE();

SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE asin_import_tasks ADD COLUMN pass_refetch_count INT DEFAULT 0 COMMENT ''新品重取放行(已采过<30天)'' AFTER pass_count',
    'SELECT ''pass_refetch_count already exists''')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=@db AND TABLE_NAME='asin_import_tasks' AND COLUMN_NAME='pass_refetch_count'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE asin_import_tasks ADD COLUMN pass_new_count INT DEFAULT 0 COMMENT ''全新通过(从没见过的ASIN)'' AFTER pass_refetch_count',
    'SELECT ''pass_new_count already exists''')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=@db AND TABLE_NAME='asin_import_tasks' AND COLUMN_NAME='pass_new_count'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
