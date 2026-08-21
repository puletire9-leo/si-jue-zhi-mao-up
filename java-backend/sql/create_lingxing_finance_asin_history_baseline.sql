-- 财务日报远程历史销量最小基线。
-- 每个 ASIN 只保留首次出现正销量的日期，避免为日报复制 60 万行周明细。
-- 日报运行时再叠加 RDS lingxing_product_performance_daily 的既往日事实。

CREATE TABLE IF NOT EXISTS `lingxing_finance_asin_history_baseline` (
    `asin` VARCHAR(32) NOT NULL COMMENT 'ASIN',
    `first_positive_date` DATE NOT NULL COMMENT '首次出现正销量的周结束日期',
    `source_cutoff_date` DATE NOT NULL COMMENT '生成基线时源周表的数据截止日期',
    `refreshed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP COMMENT '最近刷新时间',
    PRIMARY KEY (`asin`),
    KEY `idx_first_positive_date` (`first_positive_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='财务日报 ASIN 首次正销量远程基线';
