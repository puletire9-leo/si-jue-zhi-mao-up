-- =================================================================
-- 领星产品表现日表（productPerformance/asinList 单日落库）
-- 2026-08-14 · 理实财务日报自动化：FINANCE_DAILY_REPORT
-- =================================================================
-- 语义：
--   与周表 lingxing_product_performance 不同，本表按「单日」落库：
--   start_date = end_date = reportDate，summary_field = asin。
--   只落理实团队开发人的 ASIN（蒋舒/陈杨/宋凤莉/刘淼/龙梦临/周沁仪/黄雨珊/夏浩宇）。
--   幂等键 = summary_field:summary_value|sidScope|dataDate|currency，
--   同一日期反复同步只更新不堆积。
-- 用途：
--   财务日报 5 维度（总/运营/开发/非标品/上架时间）的当日事实来源；
--   累计销量判断（断货SKU 公式）复用本地历史周表 + 本表更早日期的行，避免未来泄漏。
-- 约束：sid 必填、上限 200；多店铺请求批间/页间间隔 10s（令牌桶=1）。
-- charset/collation 与其它 lingxing_* 一致（utf8mb4_unicode_ci）。
-- =================================================================

CREATE TABLE IF NOT EXISTS `lingxing_product_performance_daily` (
    `id`                      BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
    `biz_key`                 VARCHAR(255) NOT NULL COMMENT '业务幂等键 summary:value|sidScope|dataDate|currency',
    `summary_field`           VARCHAR(32)  DEFAULT NULL COMMENT '汇总维度：asin',
    `summary_value`           VARCHAR(255) DEFAULT NULL COMMENT '汇总维度值',
    `sid_scope`               VARCHAR(500) DEFAULT NULL COMMENT '查询店铺集合(排序逗号拼接)',
    `asin`                    VARCHAR(20)  DEFAULT NULL COMMENT 'ASIN',
    `parent_asin`             VARCHAR(20)  DEFAULT NULL COMMENT '父 ASIN',
    `msku`                    VARCHAR(128) DEFAULT NULL COMMENT 'MSKU',
    `sku`                     VARCHAR(128) DEFAULT NULL COMMENT '本地 SKU',
    `item_name`               VARCHAR(1000) DEFAULT NULL COMMENT '标题',
    `currency_code`           VARCHAR(16)  DEFAULT NULL COMMENT '币种编码',
    `marketplace`             VARCHAR(8)   DEFAULT NULL COMMENT 'UK/DE；历史未拆分数据为空',
    `data_date`               DATE         DEFAULT NULL COMMENT '数据日期(单日)',
    `principal_names`         VARCHAR(500) DEFAULT NULL COMMENT '负责人(逗号拼接)',
    `developer_names`         VARCHAR(500) DEFAULT NULL COMMENT '开发人(逗号拼接)',
    `store_names`             VARCHAR(1000) DEFAULT NULL COMMENT '店铺名(逗号拼接)',
    `tag_names`               VARCHAR(1000) DEFAULT NULL COMMENT 'listing标签(逗号拼接)',
    `product_create_time`     VARCHAR(64)  DEFAULT NULL COMMENT '商品创建时间(原始串)',
    `volume`                  INT          DEFAULT NULL COMMENT '销量',
    `order_items`             INT          DEFAULT NULL COMMENT '订单量',
    `amount`                  DECIMAL(18,4) DEFAULT NULL COMMENT '销售额',
    `gross_profit`            DECIMAL(18,4) DEFAULT NULL COMMENT '结算毛利润',
    `gross_margin`            DECIMAL(18,6) DEFAULT NULL COMMENT '结算毛利率',
    `sessions_total`          INT          DEFAULT NULL COMMENT 'Sessions-Total',
    `clicks`                  INT          DEFAULT NULL COMMENT '点击',
    `impressions`             INT          DEFAULT NULL COMMENT '展示',
    `ad_order_quantity`       INT          DEFAULT NULL COMMENT '广告订单量',
    `ad_sales_amount`         DECIMAL(18,4) DEFAULT NULL COMMENT '广告销售额',
    `spend`                   DECIMAL(18,4) DEFAULT NULL COMMENT '广告花费',
    `tacos`                   DECIMAL(18,6) DEFAULT NULL COMMENT 'TACOS',
    `afn_fulfillable_quantity` INT         DEFAULT NULL COMMENT 'FBA可售库存',
    `available_inventory`      INT         DEFAULT NULL COMMENT '可用库存',
    `return_amount`            DECIMAL(18,4) DEFAULT NULL COMMENT '退款金额',
    `avg_custom_price`         DECIMAL(18,4) DEFAULT NULL COMMENT '平均售价',
    `raw_json`                JSON         DEFAULT NULL COMMENT '领星原始行整包留底',
    `synced_at`               DATETIME     DEFAULT CURRENT_TIMESTAMP COMMENT '本地同步入库时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_biz_key` (`biz_key`),
    INDEX `idx_asin` (`asin`),
    INDEX `idx_data_date` (`data_date`)
    ,INDEX `idx_daily_marketplace_date` (`marketplace`, `data_date`, `asin`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='领星产品表现日表(asinList 单日落库)';
