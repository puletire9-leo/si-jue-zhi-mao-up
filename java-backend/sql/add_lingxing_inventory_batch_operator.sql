-- Add operator (batch creator / operations staff) column to lingxing_inventory_batch_detail
-- 2026-08-11

USE sijuelishi;

-- Add column if not exists
SELECT COUNT(*) INTO @col_exists
FROM information_schema.columns
WHERE table_schema = 'sijuelishi'
  AND table_name = 'lingxing_inventory_batch_detail'
  AND column_name = 'operator';

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE lingxing_inventory_batch_detail ADD COLUMN operator VARCHAR(64) NULL COMMENT ''运营负责人（批次创建人）'' AFTER developer',
    'SELECT ''Column operator already exists'' AS message');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add index for operator filter
SELECT COUNT(*) INTO @idx_exists
FROM information_schema.statistics
WHERE table_schema = 'sijuelishi'
  AND table_name = 'lingxing_inventory_batch_detail'
  AND index_name = 'idx_operator';

SET @sql_idx = IF(@idx_exists = 0,
    'ALTER TABLE lingxing_inventory_batch_detail ADD INDEX idx_operator (operator)',
    'SELECT ''Index idx_operator already exists'' AS message');

PREPARE stmt_idx FROM @sql_idx;
EXECUTE stmt_idx;
DEALLOCATE PREPARE stmt_idx;
