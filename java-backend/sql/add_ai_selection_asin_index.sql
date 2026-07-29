-- =================================================================
-- 为 AI 选品按 ASIN 查询补充索引
-- 2026-07-27
--
-- 背景：AI 选品 /lookup 与 /push 按 asin IN (...) 查两张市场表。
--   shop_products 的 asin 位于 uk_shop_asin_batch 第 3 列，
--   competitor_products_clean 无 asin 左前缀索引，
--   EXPLAIN 实测两表均为全表扫描（约 46 万 / 20 万行）。
-- 方案：各加一个 (asin, marketplace) 复合索引，覆盖按 ASIN
--   （可选叠加 marketplace）的查询左前缀。
-- 安全：MySQL 8.0 online DDL（ALGORITHM=INPLACE, LOCK=NONE），
--   不阻塞读写；可用 DROP INDEX 回滚。
-- 幂等：用 information_schema 守卫，重复执行不报错。
-- =================================================================

-- shop_products.idx_shop_asin_mp
SET @idx_exists := (
    SELECT COUNT(1) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'shop_products'
      AND INDEX_NAME = 'idx_shop_asin_mp'
);
SET @sql := IF(@idx_exists = 0,
    'ALTER TABLE `shop_products` ADD INDEX `idx_shop_asin_mp` (`asin`, `marketplace`), ALGORITHM=INPLACE, LOCK=NONE',
    'SELECT "idx_shop_asin_mp already exists" AS msg');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- competitor_products_clean.idx_clean_asin_mp
SET @idx_exists := (
    SELECT COUNT(1) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'competitor_products_clean'
      AND INDEX_NAME = 'idx_clean_asin_mp'
);
SET @sql := IF(@idx_exists = 0,
    'ALTER TABLE `competitor_products_clean` ADD INDEX `idx_clean_asin_mp` (`asin`, `marketplace`), ALGORITHM=INPLACE, LOCK=NONE',
    'SELECT "idx_clean_asin_mp already exists" AS msg');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
