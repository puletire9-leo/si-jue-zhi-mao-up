-- =================================================================
-- 领星产品统一表（ASIN 维度宽表，每 ASIN 一行）
-- 2026-07-30 · 领星自动同步：产品表现每周同步后自动重算此表
-- 2026-08-11 · 上架时间简化为单一字段，首次写入后锁定，后续周只更新经营指标
-- =================================================================
-- 语义：
--   把领星多张表按 ASIN 汇总成一张"产品统一表"，供模型页/选品直接查。
--   产出物从原 CSV（基础统一表目录）升级为 MySQL 表。
--
-- 数据来源（纯读库加工，不调领星 API）：
--   lingxing_sku_weekly_performance    → 经营指标聚合 + FBA首现 + 创建日期(raw_json)
--   lingxing_listing                   → open_date 真实上架日
--   lingxing_local_product             → developer（按 sku 关联）
--
-- 上架时间（单一字段，一次性写入）：
--   listing_time = 三级兜底优先级——FBA可售首现月 → listing真实上架日 → 商品创建时间
--   首次写入后永久锁定，后续只更新经营指标，不动上架时间
--   listing_time_source 记录最终采用的依据
--
-- charset/collation 与其它 lingxing_* 一致（utf8mb4_unicode_ci）。
-- =================================================================

CREATE TABLE IF NOT EXISTS `lingxing_product_unified` (
    `id`                        BIGINT        NOT NULL                  COMMENT '主键（雪花算法）',
    `asin`                      VARCHAR(32)   NOT NULL                  COMMENT 'ASIN（业务唯一键）',

    -- ── 身份信息 ──
    `parent_asin`              VARCHAR(32)   DEFAULT NULL              COMMENT '父 ASIN',
    `base_sku`                  VARCHAR(255)  DEFAULT NULL              COMMENT '基准 SKU',
    `base_msku`                 VARCHAR(255)  DEFAULT NULL              COMMENT '基准 MSKU',
    `base_store`                VARCHAR(255)  DEFAULT NULL              COMMENT '基准店铺',
    `country`                   VARCHAR(32)   DEFAULT NULL              COMMENT '国家',
    `developer`                 VARCHAR(255)  DEFAULT NULL              COMMENT '开发人',
    `principal`                 VARCHAR(255)  DEFAULT NULL              COMMENT '负责人',
    `title`                     VARCHAR(1000) DEFAULT NULL              COMMENT '标题',
    `listing_tags`              VARCHAR(500)  DEFAULT NULL              COMMENT 'Listing 标签',
    `product_create_time`      VARCHAR(64)   DEFAULT NULL              COMMENT '商品信息创建时间（原始月表）',

    -- ── 上架时间（单一字段，首次写入后锁定）──
    `listing_time`             VARCHAR(7)    DEFAULT NULL              COMMENT '上架月份 YYYY-MM（三级兜底，首次写入后不变）',
    `listing_time_source`      VARCHAR(64)   DEFAULT NULL              COMMENT '上架时间依据（周表FBA可售首现/listing真实上架日/商品创建时间兜底）',

    -- ── 经营指标汇总（从周表聚合，全期累计，每周刷新）──
    `total_volume`             BIGINT        DEFAULT NULL              COMMENT '累计销量',
    `total_amount`             DECIMAL(20,4) DEFAULT NULL              COMMENT '累计销售额',
    `total_order_items`        BIGINT        DEFAULT NULL              COMMENT '累计订单量',
    `total_gross_profit`       DECIMAL(20,4) DEFAULT NULL              COMMENT '累计毛利润',
    `avg_gross_margin`         DECIMAL(10,4) DEFAULT NULL              COMMENT '平均毛利率',
    `active_months`            INT           DEFAULT NULL              COMMENT '有销量的活跃月数',
    `first_sale_month`         VARCHAR(7)    DEFAULT NULL              COMMENT '首个有销量月',
    `last_sale_month`          VARCHAR(7)    DEFAULT NULL              COMMENT '最近有销量月',

    -- ── 最近月快照 ──
    `latest_month`             VARCHAR(7)    DEFAULT NULL              COMMENT '最近月份',
    `latest_volume`            BIGINT        DEFAULT NULL              COMMENT '最近月销量',
    `latest_amount`            DECIMAL(20,4) DEFAULT NULL              COMMENT '最近月销售额',
    `latest_fba_available`     BIGINT        DEFAULT NULL              COMMENT '最近月 FBA 可售',
    `latest_cate_rank`         VARCHAR(255)  DEFAULT NULL              COMMENT '最近月类目排名',
    `latest_avg_star`          DECIMAL(4,2)  DEFAULT NULL              COMMENT '最近月星级',
    `latest_reviews_count`     INT           DEFAULT NULL              COMMENT '最近月评论数',

    -- ── FBA 首现明细（从周表按时间序算）──
    `fba_inventory_first_month` VARCHAR(7)  DEFAULT NULL              COMMENT 'FBA 库存首现月',
    `inventory_first_store`    VARCHAR(255)  DEFAULT NULL              COMMENT '库存首现店铺',
    `inventory_first_country`  VARCHAR(32)   DEFAULT NULL              COMMENT '库存首现国家',
    `inventory_first_sku`      VARCHAR(255)  DEFAULT NULL              COMMENT '库存首现 SKU',
    `inventory_first_qty`      INT           DEFAULT NULL              COMMENT '库存首现数量',
    `available_first_store`    VARCHAR(255)  DEFAULT NULL              COMMENT 'FBA 可售首现店铺',
    `available_first_country`  VARCHAR(32)   DEFAULT NULL              COMMENT 'FBA 可售首现国家',
    `available_first_sku`      VARCHAR(255)  DEFAULT NULL              COMMENT 'FBA 可售首现 SKU',
    `available_first_qty`      INT           DEFAULT NULL              COMMENT 'FBA 可售首现数量',
    `fba_observation_status`   VARCHAR(64)   DEFAULT NULL              COMMENT 'FBA 观测状态',

    -- ── 元数据 ──
    `data_cutoff_month`        VARCHAR(7)    DEFAULT NULL              COMMENT '数据覆盖截止月',
    `unified_version`          VARCHAR(64)   DEFAULT NULL              COMMENT '统一表算法版本',
    `synced_at`                DATETIME      DEFAULT CURRENT_TIMESTAMP COMMENT '本地重算入库时间',

    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_asin` (`asin`),
    INDEX `idx_developer` (`developer`),
    INDEX `idx_listing_time` (`listing_time`),
    INDEX `idx_last_sale` (`last_sale_month`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='领星产品统一表（ASIN 维度宽表，每 ASIN 一行，每周刷新经营指标）';