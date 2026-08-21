-- 运营物流状态必须以本地仓可用量判断是否可以发往亚马逊。
SET @has_available_quantity := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'operations_logistics_purchase_progress'
    AND column_name = 'available_quantity'
);

SET @ddl := IF(
  @has_available_quantity = 0,
  'ALTER TABLE operations_logistics_purchase_progress ADD COLUMN available_quantity INT NOT NULL DEFAULT 0 COMMENT ''当前可用于发亚马逊的本地仓可用量'' AFTER received_quantity',
  'SELECT 1'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
