-- =================================================================
-- 店铺分析第二/三条数据线：shop_products（店铺商品全集）+ shop_watchlist（店铺观察池）
-- 设计见 docs/店铺品级/店铺画像证据层实施计划.md 五-3 / 五-4，日志 docs/日志/7.8.md。
-- =================================================================
-- 三条数据线边界：
--   competitor_products / _clean —— 八爪鱼新品榜 + ASIN 补数，服务方法卡（已存在）
--   shop_watchlist               —— 记录哪些店值得盯 + 为什么（本脚本新建）
--   shop_products                —— 卖家精灵"店铺名查询"店铺商品全集，固定 variation=Y（本脚本新建）
-- shop_products 字段能力完整复制 competitor_products（CREATE TABLE LIKE，与
-- competitor_products_clean 同范式），保证店铺画像/明细/方法卡解释不因分表丢字段。
-- 幂等可重跑：列/索引变更全部用 information_schema 守卫，参照 add_m01_active_flag.sql。
-- charset utf8mb4_unicode_ci，与其它表一致。
-- =================================================================

SET NAMES utf8mb4;
SET @schema_name := DATABASE();

-- -----------------------------------------------------------------
-- 1. shop_products：LIKE competitor_products 复制全字段结构 + 字符集
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shop_products LIKE competitor_products;

-- 1.1 去掉从 competitor_products 继承来的新品榜唯一键（店铺全集去重口径不同）
SET @sql := IF(
    (SELECT COUNT(1) FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'shop_products'
       AND INDEX_NAME = 'uk_asin_month') > 0,
    'ALTER TABLE shop_products DROP INDEX uk_asin_month',
    'SELECT ''shop_products.uk_asin_month absent'''
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 1.2 店铺抓取专用列（幂等：列不存在才加）
SET @sql := IF(
    (SELECT COUNT(1) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'shop_products'
       AND COLUMN_NAME = 'batch_date') = 0,
    'ALTER TABLE shop_products ADD COLUMN batch_date VARCHAR(64) NULL COMMENT ''店铺抓取批次 yyyyMMdd''',
    'SELECT ''shop_products.batch_date exists'''
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
    (SELECT COUNT(1) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'shop_products'
       AND COLUMN_NAME = 'source_run_id') = 0,
    'ALTER TABLE shop_products ADD COLUMN source_run_id VARCHAR(64) NULL COMMENT ''本次店铺抓取任务ID''',
    'SELECT ''shop_products.source_run_id exists'''
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
    (SELECT COUNT(1) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'shop_products'
       AND COLUMN_NAME = 'fetch_source') = 0,
    'ALTER TABLE shop_products ADD COLUMN fetch_source VARCHAR(32) NOT NULL DEFAULT ''SELLERSPRITE_SHOP'' COMMENT ''抓取来源标识''',
    'SELECT ''shop_products.fetch_source exists'''
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
    (SELECT COUNT(1) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'shop_products'
       AND COLUMN_NAME = 'fetch_reason') = 0,
    'ALTER TABLE shop_products ADD COLUMN fetch_reason VARCHAR(255) NULL COMMENT ''抓取原因：M01高命中/人工加入/郑总相似''',
    'SELECT ''shop_products.fetch_reason exists'''
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
    (SELECT COUNT(1) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'shop_products'
       AND COLUMN_NAME = 'watchlist_id') = 0,
    'ALTER TABLE shop_products ADD COLUMN watchlist_id BIGINT NULL COMMENT ''来源观察池记录 shop_watchlist.id，可空''',
    'SELECT ''shop_products.watchlist_id exists'''
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
    (SELECT COUNT(1) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'shop_products'
       AND COLUMN_NAME = 'variation_mode') = 0,
    'ALTER TABLE shop_products ADD COLUMN variation_mode VARCHAR(8) NOT NULL DEFAULT ''Y'' COMMENT ''固定 Y=不含变体父体口径''',
    'SELECT ''shop_products.variation_mode exists'''
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
    (SELECT COUNT(1) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'shop_products'
       AND COLUMN_NAME = 'raw_json') = 0,
    'ALTER TABLE shop_products ADD COLUMN raw_json JSON NULL COMMENT ''卖家精灵店铺接口原始返回整包留底''',
    'SELECT ''shop_products.raw_json exists'''
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
    (SELECT COUNT(1) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'shop_products'
       AND COLUMN_NAME = 'first_seen_at') = 0,
    'ALTER TABLE shop_products ADD COLUMN first_seen_at DATETIME NULL COMMENT ''该店商品首次在全集表出现''',
    'SELECT ''shop_products.first_seen_at exists'''
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
    (SELECT COUNT(1) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'shop_products'
       AND COLUMN_NAME = 'last_seen_at') = 0,
    'ALTER TABLE shop_products ADD COLUMN last_seen_at DATETIME NULL COMMENT ''最近一次店铺抓取仍出现''',
    'SELECT ''shop_products.last_seen_at exists'''
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 1.3 店铺全集唯一键：marketplace + seller_name + asin + batch_date（幂等重跑覆盖同批次同店同 ASIN）
SET @sql := IF(
    (SELECT COUNT(1) FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'shop_products'
       AND INDEX_NAME = 'uk_shop_asin_batch') = 0,
    'ALTER TABLE shop_products ADD UNIQUE KEY uk_shop_asin_batch (marketplace, seller_name, asin, batch_date)',
    'SELECT ''shop_products.uk_shop_asin_batch exists'''
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
    (SELECT COUNT(1) FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'shop_products'
       AND INDEX_NAME = 'idx_shop_products_seller') = 0,
    'CREATE INDEX idx_shop_products_seller ON shop_products (marketplace, seller_name, batch_date)',
    'SELECT ''shop_products.idx_shop_products_seller exists'''
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
    (SELECT COUNT(1) FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'shop_products'
       AND INDEX_NAME = 'idx_shop_products_watchlist') = 0,
    'CREATE INDEX idx_shop_products_watchlist ON shop_products (watchlist_id)',
    'SELECT ''shop_products.idx_shop_products_watchlist exists'''
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- -----------------------------------------------------------------
-- 2. shop_watchlist：店铺观察池，记录哪些店值得盯 + 为什么
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shop_watchlist (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键',
    marketplace VARCHAR(16) NOT NULL COMMENT '站点/国家',
    seller_name VARCHAR(255) NOT NULL COMMENT '店铺名',
    seller_id VARCHAR(128) NULL COMMENT '卖家ID，可为空',
    source_type VARCHAR(32) NOT NULL COMMENT 'METHOD_CARD/BASELINE/MANUAL/OWN_GOOD_SIMILAR/CATEGORY',
    source_code VARCHAR(64) NOT NULL DEFAULT '' COMMENT 'M01/M03/ZHENG_UK_DE/OWN_GOOD_SHOPS 等',
    reason VARCHAR(512) NULL COMMENT '中文原因：M01新品命中多/类目集中/ABC厚',
    hit_count INT NULL COMMENT '进入观察池时的方法卡命中数，可为空',
    top_category VARCHAR(255) NULL COMMENT '进入观察池时的主类目',
    status VARCHAR(32) NOT NULL DEFAULT 'WATCHING' COMMENT 'WATCHING/FETCHED/CONFIRMED/IGNORED',
    last_fetch_run_id VARCHAR(64) NULL COMMENT '最近一次店铺抓取任务',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    UNIQUE KEY uk_shop_watchlist (marketplace, seller_name, source_type, source_code),
    KEY idx_shop_watchlist_source (source_type, source_code, status),
    KEY idx_shop_watchlist_status (marketplace, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='店铺观察池：记录值得盯的店铺及原因';
