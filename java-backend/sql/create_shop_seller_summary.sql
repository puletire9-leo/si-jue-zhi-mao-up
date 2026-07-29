-- 店铺选品「按店铺聚合画像」物化快照表 shop_seller_summary。
--
-- 背景：selectionShops/summary 每次实时跑 7 层 CTE + 2×ROW_NUMBER() 全量聚合
--   （见 ShopProfileMapper.xml selectSummaryFromShopProducts + enrichSummary3d），
--   几十万行下秒级，是「打开筛选抽屉选卖家」卡顿的根因。
--
-- 方案：把 ShopProfileSummary(42 标量字段) 扁平物化到本表。刷新时由 Service 跑一次
--   现有活算逻辑(completeSummary + enrichSummary3d 全部 Java 派生字段都算好)再整站替换，
--   读路径退化为按 (marketplace) 单表 SELECT + LIMIT。口径与活算完全一致(同一套代码产出)。
--
-- 粒度：一行 = 一个 (marketplace, seller_name) 在「最新批次」的聚合画像。
--   selectionShops 常规列表不带 batch_date/sourceRunId(只按 marketplace 取最新)，故快照按
--   marketplace + seller_name 唯一；latest_batch_date 记录该行数据对应的批次，供前端展示与校验。
--
-- 幂等可重跑：CREATE TABLE IF NOT EXISTS。
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS shop_seller_summary (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键',
    marketplace VARCHAR(16) NOT NULL COMMENT '站点 UK/DE/US',
    seller_name VARCHAR(255) NOT NULL COMMENT '店铺名',
    seller_id VARCHAR(128) NULL COMMENT '卖家ID',

    product_count BIGINT NULL COMMENT '父体去重后商品数',
    a_count BIGINT NULL, b_count BIGINT NULL, c_count BIGINT NULL,
    d_count BIGINT NULL, unknown_count BIGINT NULL,
    ab_count BIGINT NULL, abc_count BIGINT NULL,
    a_ratio DOUBLE NULL, ab_ratio DOUBLE NULL, abc_ratio DOUBLE NULL, d_ratio DOUBLE NULL,

    top_a_category VARCHAR(255) NULL,
    top_abc_category VARCHAR(255) NULL,
    top_d_category VARCHAR(255) NULL,
    profile_type VARCHAR(64) NULL COMMENT '结构标签(中文,5种)',
    latest_batch_date VARCHAR(64) NULL COMMENT '该行聚合对应的最新批次 yyyyMMdd',
    variation_mode VARCHAR(8) NULL DEFAULT 'Y',

    m01_hit_count BIGINT NULL, m01_hit_ratio DOUBLE NULL,
    avg_listing_days DOUBLE NULL, avg_units DOUBLE NULL,
    earliest_available_date BIGINT NULL,
    earliest_available_date_text VARCHAR(32) NULL,
    max_listing_days INT NULL,
    new30_count BIGINT NULL, new90_count BIGINT NULL, new180_count BIGINT NULL,
    old180_count BIGINT NULL, unknown_listing_days_count BIGINT NULL,

    new_product_count BIGINT NULL,
    new_abc_count BIGINT NULL, new_abc_ratio DOUBLE NULL,
    old_d_count BIGINT NULL, old_d_ratio DOUBLE NULL,

    good_tendency_count BIGINT NULL,
    attention_strong_count BIGINT NULL,
    attention_review_count BIGINT NULL,

    shop_profile_3d_type VARCHAR(64) NULL,
    shop_profile_3d_explanation VARCHAR(512) NULL,

    refreshed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '快照刷新时间',
    UNIQUE KEY uk_shop_seller_summary (marketplace, seller_name),
    KEY idx_sss_list (marketplace, product_count, abc_count)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='店铺选品按店铺聚合画像物化快照(ShopProfileSummary 扁平落库)';