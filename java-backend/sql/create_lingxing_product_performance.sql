-- =================================================================
-- 领星产品表现表（productPerformance/asinList 落库）
-- 2026-07-03 · 领星数据对接：按店铺+时间窗拉产品表现 → 双写落库
-- =================================================================
-- 语义：
--   领星「查询产品表现」（POST /bd/productPerformance/openApi/asinList）。
--   双写：少量结构化关键列（销量/销售额/毛利/流量/广告）+ raw_json 整包
--         （200+ 指标，张总蓝本 §一.1）。
--   幂等：报表类用「维度 + 查询时间窗」组合唯一键（张总蓝本 §一.2）——
--         biz_key = summaryField:value|sidScope|start|end|currency，
--         同一时间窗反复同步只更新不堆积。
--   约束：start_date~end_date 跨度 ≤ 92 天；sid 必填、上限 200。
-- charset/collation 与其它领星表一致（utf8mb4_unicode_ci）。
-- =================================================================

CREATE TABLE IF NOT EXISTS `lingxing_product_performance` (
    `id`             BIGINT        NOT NULL                  COMMENT '主键（雪花算法）',
    `biz_key`        VARCHAR(255)  NOT NULL                  COMMENT '业务幂等键 summaryField:value|sidScope|start|end|currency',
    `summary_field`  VARCHAR(32)   DEFAULT NULL              COMMENT '汇总维度：asin/parent_asin/msku/sku',
    `summary_value`  VARCHAR(255)  DEFAULT NULL              COMMENT '汇总维度值',
    `sid_scope`      VARCHAR(500)  DEFAULT NULL              COMMENT '查询店铺集合（排序逗号拼接）',
    `asin`           VARCHAR(20)   DEFAULT NULL              COMMENT 'ASIN',
    `parent_asin`    VARCHAR(20)   DEFAULT NULL              COMMENT '父 ASIN',
    `msku`           VARCHAR(128)  DEFAULT NULL              COMMENT 'MSKU',
    `sku`            VARCHAR(128)  DEFAULT NULL              COMMENT '本地 SKU',
    `item_name`      VARCHAR(1000) DEFAULT NULL              COMMENT '标题',
    `currency_code`  VARCHAR(16)   DEFAULT NULL              COMMENT '币种编码',
    `start_date`     DATE          DEFAULT NULL              COMMENT '查询时间窗-开始',
    `end_date`       DATE          DEFAULT NULL              COMMENT '查询时间窗-结束',
    `volume`         INT           DEFAULT NULL              COMMENT '销量',
    `order_items`    INT           DEFAULT NULL              COMMENT '订单量',
    `amount`         DECIMAL(18,4) DEFAULT NULL              COMMENT '销售额',
    `gross_profit`   DECIMAL(18,4) DEFAULT NULL              COMMENT '结算毛利润',
    `gross_margin`   DECIMAL(18,6) DEFAULT NULL              COMMENT '结算毛利率',
    `sessions_total` INT           DEFAULT NULL              COMMENT 'Sessions-Total',
    `spend`          DECIMAL(18,4) DEFAULT NULL              COMMENT '广告花费',
    `tacos`          DECIMAL(18,6) DEFAULT NULL              COMMENT 'TACOS',
    `raw_json`       JSON          DEFAULT NULL              COMMENT '领星原始行整包留底',
    `synced_at`      DATETIME      DEFAULT CURRENT_TIMESTAMP COMMENT '本地同步入库时间',

    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_biz_key` (`biz_key`),
    INDEX `idx_asin` (`asin`),
    INDEX `idx_msku` (`msku`),
    INDEX `idx_date` (`start_date`, `end_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='领星产品表现（asinList 落库，双写）';
