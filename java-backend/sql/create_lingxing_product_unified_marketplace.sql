-- 统一表 ASIN 国家关系（远程 RDS）。
-- 不修改现有“一 ASIN 一行”的统一表，避免影响所有周模型；财务用本表按 UK/DE 分流。
CREATE TABLE IF NOT EXISTS `lingxing_product_unified_marketplace` (
  `asin`              VARCHAR(32) NOT NULL COMMENT '统一表目标 ASIN',
  `marketplace`       VARCHAR(8)  NOT NULL COMMENT 'UK/DE',
  `currency_code`     VARCHAR(8)  NOT NULL COMMENT 'GBP/EUR',
  `latest_sid`        BIGINT      DEFAULT NULL COMMENT '最近观测店铺 SID',
  `first_seen_date`   DATE        DEFAULT NULL COMMENT '周表首次出现日期',
  `last_seen_date`    DATE        DEFAULT NULL COMMENT '周表最近出现日期',
  `source_week_end`   DATE        DEFAULT NULL COMMENT '关系刷新所依据的最新完整周',
  `active`            TINYINT     NOT NULL DEFAULT 1 COMMENT '1=当前有效',
  `updated_at`        DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`asin`, `marketplace`),
  KEY `idx_marketplace_active` (`marketplace`, `active`, `asin`),
  KEY `idx_source_week_end` (`source_week_end`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='统一表目标ASIN国家关系；财务UK/DE分流，不改变现有模型统一表主键';
