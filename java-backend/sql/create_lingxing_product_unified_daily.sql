-- 统一表日快照（远程 RDS）
-- 财务日报按「国家+ASIN」把当天日事实重建成统一表日快照。
-- 某日快照只代表该日，由当天 lingxing_product_performance_daily 重算，禁止用最新统一表覆盖历史日期。
CREATE TABLE IF NOT EXISTS `lingxing_product_unified_daily` (
    `data_date`            DATE         NOT NULL COMMENT '快照日期',
    `marketplace`          VARCHAR(8)   NOT NULL COMMENT 'UK/DE',
    `asin`                 VARCHAR(32)  NOT NULL COMMENT 'ASIN',
    `parent_asin`          VARCHAR(32)  DEFAULT NULL COMMENT '父 ASIN',
    `country`              VARCHAR(16)  DEFAULT NULL COMMENT '统一表国家',
    `developer`            VARCHAR(128) DEFAULT NULL COMMENT '开发人',
    `principal`            VARCHAR(128) DEFAULT NULL COMMENT '负责人',
    `listing_tags`         VARCHAR(1000) DEFAULT NULL COMMENT 'listing 标签',
    `listing_date`         DATE         DEFAULT NULL COMMENT '统一表上架日期',
    `product_create_time`  VARCHAR(64)  DEFAULT NULL COMMENT '商品创建时间',
    `title`                VARCHAR(1000) DEFAULT NULL COMMENT '标题',
    `base_sku`             VARCHAR(128) DEFAULT NULL COMMENT '本地 SKU',
    `synced_at`            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '快照写入时间',
    PRIMARY KEY (`data_date`, `marketplace`, `asin`),
    KEY `idx_unified_daily_marketplace` (`marketplace`, `data_date`, `asin`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='统一表国家+ASIN日快照，财务SKU总量按该日行数计';
