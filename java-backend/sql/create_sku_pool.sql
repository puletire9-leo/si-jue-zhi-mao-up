-- =================================================================
-- SKU 池表
-- 2026-07-09 · 领星 UK/DE 目标标签 SKU 自动筛选
-- =================================================================
-- 来源：
--   lingxing_product_performance.raw_json.tag_set
--   自动按 6 个目标标签筛选，不依赖领星后台导出/Markdown 导入。
--
-- 目标标签：
--   绿标、欧洲精铺2025、欧洲精铺2025非标品、欧洲精铺2025季节性断货、
--   欧洲精铺2025待淘汰、欧洲精铺2025淘汰
-- =================================================================

CREATE TABLE IF NOT EXISTS `sku_pool` (
    `id`              BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
    `sku`             VARCHAR(128)  NOT NULL                COMMENT '本地 SKU',
    `asin`            VARCHAR(32)   DEFAULT NULL            COMMENT 'ASIN',
    `parent_asin`     VARCHAR(32)   DEFAULT NULL            COMMENT '父 ASIN',
    `product_name`    VARCHAR(512)  DEFAULT NULL            COMMENT '品名/标题',
    `marketplace`     VARCHAR(8)    NOT NULL                COMMENT '站点：UK/DE',
    `mid`             INT           NOT NULL                COMMENT '领星站点 ID：UK=4，DE=5',
    `tag_ids`         VARCHAR(512)  DEFAULT NULL            COMMENT '命中的领星标签 ID（逗号分隔）',
    `tags`            VARCHAR(512)  DEFAULT NULL            COMMENT '命中的领星标签名称（逗号分隔）',
    `developer`       VARCHAR(128)  DEFAULT NULL            COMMENT '开发人',
    `cg_price`        DECIMAL(18,4) DEFAULT NULL            COMMENT '采购成本',
    `pic_url`         VARCHAR(1000) DEFAULT NULL            COMMENT '主图',
    `status`          INT           DEFAULT NULL            COMMENT '本地产品状态',
    `status_text`     VARCHAR(64)   DEFAULT NULL            COMMENT '本地产品状态文本',
    `source`          VARCHAR(64)   NOT NULL DEFAULT 'LINGXING_PERFORMANCE_TAG_SET' COMMENT '来源',
    `snapshot_week`   VARCHAR(8)    NOT NULL                COMMENT 'ISO 周 yyyy-Www',
    `first_seen_week` VARCHAR(8)    DEFAULT NULL            COMMENT '首次进入 SKU 池周',
    `last_seen_week`  VARCHAR(8)    DEFAULT NULL            COMMENT '最近进入 SKU 池周',
    `is_active`       TINYINT       NOT NULL DEFAULT 1      COMMENT '当前快照是否有效',
    `created_at`      DATETIME      DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at`      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_sku_market_week` (`sku`, `marketplace`, `snapshot_week`),
    KEY `idx_week_active` (`snapshot_week`, `is_active`),
    KEY `idx_market_week` (`marketplace`, `snapshot_week`),
    KEY `idx_sku` (`sku`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='领星目标标签 SKU 池';
