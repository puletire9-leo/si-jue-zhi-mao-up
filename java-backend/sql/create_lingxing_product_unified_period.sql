-- 统一表（周/日同一张）。表名 period = 时间窗，不要理解成只有日数据。
-- 日：period_start = period_end = 当天。周：period_start = 周起始，period_end = 周结束。
CREATE TABLE IF NOT EXISTS `lingxing_product_unified_period` (
    `period_start`         DATE         NOT NULL COMMENT '时间窗开始（日=当天，周=周起始）',
    `period_end`           DATE         NOT NULL COMMENT '时间窗结束（日=当天，周=周结束）',
    `marketplace`          VARCHAR(8)   NOT NULL COMMENT 'UK/DE',
    `asin`                 VARCHAR(32)  NOT NULL COMMENT 'ASIN',
    `parent_asin`          VARCHAR(32)  DEFAULT NULL COMMENT '父 ASIN',
    `country`              VARCHAR(16)  DEFAULT NULL COMMENT '国家',
    `developer`            VARCHAR(128) DEFAULT NULL COMMENT '开发人',
    `principal`            VARCHAR(128) DEFAULT NULL COMMENT '负责人',
    `listing_tags`         VARCHAR(1000) DEFAULT NULL COMMENT 'listing 标签',
    `listing_date`         DATE         DEFAULT NULL COMMENT '4信号锁定的上架日',
    `product_create_time`  VARCHAR(64)  DEFAULT NULL COMMENT '商品创建时间',
    `title`                VARCHAR(1000) DEFAULT NULL COMMENT '标题',
    `base_sku`             VARCHAR(128) DEFAULT NULL COMMENT '本地 SKU',
    `synced_at`            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '写入时间',
    PRIMARY KEY (`period_start`, `period_end`, `marketplace`, `asin`),
    KEY `idx_unified_period_marketplace` (`marketplace`, `period_start`, `period_end`, `asin`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='统一表时间窗：周行与日行同一结构，只是时间窗精度不同';
