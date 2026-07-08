-- =================================================================
-- shop_products 补 batch_code 列：ISO 周批次 yyyy-Www
-- =================================================================
-- 背景：shop_products 当前只有 batch_date（天粒度 yyyyMMdd），
--   历史对比/多店同上分析需要按周/月聚合归组，必须补 batch_code。
--   batch_code 全系统共用一个真实来源：WeekTagUtil.currentWeekTag()。
-- 幂等可重跑：全部 information_schema 守卫。
-- charset utf8mb4_unicode_ci，与竞品表一致。
-- =================================================================

SET NAMES utf8mb4;
SET @schema_name := DATABASE();

SET @sql := IF(
    (SELECT COUNT(1) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'shop_products'
       AND COLUMN_NAME = 'batch_code') = 0,
    'ALTER TABLE shop_products ADD COLUMN batch_code VARCHAR(16) NOT NULL DEFAULT '''' COMMENT ''ISO 周批次，如 2026-W28（WeekTagUtil 生成）''',
    'SELECT ''shop_products.batch_code exists'''
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 给 batch_code 加索引：历史对比按周聚合需要
SET @sql := IF(
    (SELECT COUNT(1) FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'shop_products'
       AND INDEX_NAME = 'idx_shop_products_batch_code') = 0,
    'CREATE INDEX idx_shop_products_batch_code ON shop_products (marketplace, seller_name, batch_code)',
    'SELECT ''shop_products.idx_shop_products_batch_code exists'''
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
