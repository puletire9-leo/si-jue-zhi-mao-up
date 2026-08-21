-- Add the PPG creation batch number to the normalized logistics progress table.
SET @ppg_column_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'operations_logistics_purchase_progress'
      AND COLUMN_NAME = 'ppg_sn'
);
SET @ppg_alter_sql := IF(
    @ppg_column_exists = 0,
    'ALTER TABLE operations_logistics_purchase_progress ADD COLUMN ppg_sn VARCHAR(64) NULL COMMENT ''采购计划创建批次号（PPG）'' AFTER plan_sn, ADD KEY idx_operations_logistics_ppg (ppg_sn)',
    'SELECT 1'
);
PREPARE ppg_stmt FROM @ppg_alter_sql;
EXECUTE ppg_stmt;
DEALLOCATE PREPARE ppg_stmt;
