-- =================================================================
-- 领星利润统计-ASIN 表（profit/statistics/open/asin/list 落库）
-- 2026-07-03 · 领星数据对接：按店铺+时间窗拉利润 → 逐日双写落库
-- =================================================================
-- 语义：
--   领星「查询利润统计-ASIN」（POST /bd/profit/statistics/open/asin/list）。
--   双写：少量结构化关键列（销量/销售额/成本/毛利）+ raw_json 整包
--         （200+ 费用项，张总蓝本 §一.1）。
--   幂等：返回按 dataDate 逐日拆行，biz_key = asin|sid|dataDate|currency，
--         逐日唯一，反复同步只更新不堆积（张总蓝本 §一.2）。
--   约束：startDate~endDate 跨度 ≤ 7 天；令牌桶容量 10。
-- charset/collation 与其它领星表一致（utf8mb4_unicode_ci）。
-- =================================================================

CREATE TABLE IF NOT EXISTS `lingxing_profit_asin` (
    `id`                   BIGINT        NOT NULL                  COMMENT '主键（雪花算法）',
    `biz_key`              VARCHAR(255)  NOT NULL                  COMMENT '业务幂等键 asin|sid|dataDate|currency',
    `asin`                 VARCHAR(20)   DEFAULT NULL              COMMENT 'ASIN',
    `parent_asin`          VARCHAR(20)   DEFAULT NULL              COMMENT '父 ASIN',
    `sid`                  VARCHAR(32)   DEFAULT NULL              COMMENT '店铺 ID',
    `store_name`           VARCHAR(255)  DEFAULT NULL              COMMENT '店铺名',
    `data_date`            DATE          DEFAULT NULL              COMMENT '数据日期（逐日一行）',
    `country_code`         VARCHAR(16)   DEFAULT NULL              COMMENT '国家简码',
    `local_sku`            VARCHAR(128)  DEFAULT NULL              COMMENT 'SKU',
    `local_name`           VARCHAR(500)  DEFAULT NULL              COMMENT '品名',
    `item_name`            VARCHAR(1000) DEFAULT NULL              COMMENT '标题',
    `currency_code`        VARCHAR(16)   DEFAULT NULL              COMMENT '币种',
    `total_sales_quantity` INT           DEFAULT NULL              COMMENT '销量',
    `total_sales_amount`   DECIMAL(18,4) DEFAULT NULL              COMMENT '销售额',
    `total_ads_cost`       DECIMAL(18,4) DEFAULT NULL              COMMENT '广告费',
    `cg_price`             DECIMAL(18,4) DEFAULT NULL              COMMENT '采购成本',
    `cg_transport_costs`   DECIMAL(18,4) DEFAULT NULL              COMMENT '头程运费',
    `total_cost`           DECIMAL(18,4) DEFAULT NULL              COMMENT '合计成本',
    `gross_profit`         DECIMAL(18,4) DEFAULT NULL              COMMENT '毛利润',
    `gross_rate`           DECIMAL(18,6) DEFAULT NULL              COMMENT '毛利率',
    `raw_json`             JSON          DEFAULT NULL              COMMENT '领星原始行整包留底',
    `synced_at`            DATETIME      DEFAULT CURRENT_TIMESTAMP COMMENT '本地同步入库时间',

    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_biz_key` (`biz_key`),
    INDEX `idx_asin` (`asin`),
    INDEX `idx_sid` (`sid`),
    INDEX `idx_data_date` (`data_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='领星利润统计-ASIN（逐日落库，双写）';
