-- 财务日报 UK/DE 分币种迁移（远程 RDS，幂等）。
-- 历史无法可靠拆分的记录保留 marketplace=NULL；新数据固定 UK/DE。

SET @daily_marketplace_col := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'lingxing_product_performance_daily'
    AND column_name = 'marketplace'
);
SET @sql := IF(@daily_marketplace_col = 0,
  'ALTER TABLE lingxing_product_performance_daily ADD COLUMN marketplace VARCHAR(8) NULL COMMENT ''UK/DE；历史未拆分数据为空'' AFTER currency_code',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @daily_marketplace_idx := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'lingxing_product_performance_daily'
    AND index_name = 'idx_daily_marketplace_date'
);
SET @sql := IF(@daily_marketplace_idx = 0,
  'ALTER TABLE lingxing_product_performance_daily ADD INDEX idx_daily_marketplace_date (marketplace, data_date, asin)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @status_marketplace_col := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'lingxing_finance_asin_status_snapshot'
    AND column_name = 'marketplace'
);
SET @sql := IF(@status_marketplace_col = 0,
  'ALTER TABLE lingxing_finance_asin_status_snapshot ADD COLUMN marketplace VARCHAR(8) NOT NULL DEFAULT ''ALL'' COMMENT ''UK/DE；历史快照为ALL'' AFTER snapshot_date',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @status_pk_has_marketplace := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'lingxing_finance_asin_status_snapshot'
    AND index_name = 'PRIMARY'
    AND column_name = 'marketplace'
);
SET @sql := IF(@status_pk_has_marketplace = 0,
  'ALTER TABLE lingxing_finance_asin_status_snapshot DROP PRIMARY KEY, ADD PRIMARY KEY (snapshot_date, marketplace, asin)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @status_marketplace_idx := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'lingxing_finance_asin_status_snapshot'
    AND index_name = 'idx_finance_status_marketplace_date'
);
SET @sql := IF(@status_marketplace_idx = 0,
  'ALTER TABLE lingxing_finance_asin_status_snapshot ADD INDEX idx_finance_status_marketplace_date (marketplace, snapshot_date, asin)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
