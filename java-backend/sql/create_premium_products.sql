-- 精品榜独立商品表：复制新品榜原始商品字段，但不参与新品榜初筛和 clean 层。
CREATE TABLE IF NOT EXISTS premium_products LIKE competitor_products;

SET @has_premium_metadata = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'premium_products'
      AND COLUMN_NAME = 'bazhuayu_mapping_id'
);
SET @sql = IF(
    @has_premium_metadata = 0,
    'ALTER TABLE premium_products
        ADD COLUMN bazhuayu_mapping_id BIGINT NULL,
        ADD COLUMN bazhuayu_task_id VARCHAR(64) NULL,
        ADD COLUMN bazhuayu_task_name VARCHAR(60) NULL,
        ADD COLUMN source_run_id VARCHAR(32) NULL,
        ADD COLUMN bazhuayu_raw_json JSON NULL,
        ADD COLUMN sellersprite_raw_json JSON NULL,
        ADD COLUMN deleted TINYINT(1) NOT NULL DEFAULT 0,
        ADD KEY idx_premium_task_week (bazhuayu_mapping_id, week_tag),
        ADD KEY idx_premium_task_id (bazhuayu_task_id),
        ADD KEY idx_premium_run_id (source_run_id)',
    'SELECT ''premium_products metadata exists'''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
