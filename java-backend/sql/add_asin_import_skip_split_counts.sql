-- 把合并的 skip_count 拆成两列，让「未通过原因」能明确区分：
--   skip_main_count      = 主表已有（competitor_products 去重）
--   skip_blacklist_count = 已采过淘汰（skip_asins 命中且非新品重取候选）
-- 幂等：列已存在则跳过。skip_count 保留作汇总/旧数据兼容。
SET @db := DATABASE();

SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE asin_import_tasks ADD COLUMN skip_main_count INT DEFAULT 0 COMMENT ''主表已有(去重跳过)'' AFTER skip_count',
    'SELECT ''skip_main_count already exists''')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=@db AND TABLE_NAME='asin_import_tasks' AND COLUMN_NAME='skip_main_count'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE asin_import_tasks ADD COLUMN skip_blacklist_count INT DEFAULT 0 COMMENT ''已采过淘汰(非新品重取候选)'' AFTER skip_main_count',
    'SELECT ''skip_blacklist_count already exists''')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=@db AND TABLE_NAME='asin_import_tasks' AND COLUMN_NAME='skip_blacklist_count'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
