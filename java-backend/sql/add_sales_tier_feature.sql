-- Add reusable sales_tier product feature.
-- Idempotent for MySQL 8.x. Run in the target application database.

SET @schema_name := DATABASE();

SET @sql := IF(
    (SELECT COUNT(1) FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = @schema_name
       AND TABLE_NAME = 'competitor_products') > 0
    AND
    (SELECT COUNT(1) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @schema_name
       AND TABLE_NAME = 'competitor_products'
       AND COLUMN_NAME = 'sales_tier') = 0,
    'ALTER TABLE competitor_products ADD COLUMN sales_tier VARCHAR(16) NOT NULL DEFAULT ''UNKNOWN'' COMMENT ''Base feature: sales volume tier A/B/C/D/UNKNOWN'' AFTER units',
    'SELECT ''competitor_products.sales_tier exists or table missing'''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
    (SELECT COUNT(1) FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = @schema_name
       AND TABLE_NAME = 'competitor_products_clean') > 0
    AND
    (SELECT COUNT(1) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @schema_name
       AND TABLE_NAME = 'competitor_products_clean'
       AND COLUMN_NAME = 'sales_tier') = 0,
    'ALTER TABLE competitor_products_clean ADD COLUMN sales_tier VARCHAR(16) NOT NULL DEFAULT ''UNKNOWN'' COMMENT ''Base feature: sales volume tier A/B/C/D/UNKNOWN'' AFTER units',
    'SELECT ''competitor_products_clean.sales_tier exists or table missing'''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE competitor_products
SET sales_tier = CASE
    WHEN units IS NULL THEN 'UNKNOWN'
    WHEN units >= 100 THEN 'A'
    WHEN units >= 50 THEN 'B'
    WHEN units >= 15 THEN 'C'
    ELSE 'D'
END;

SET @sql := IF(
    (SELECT COUNT(1) FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = @schema_name
       AND TABLE_NAME = 'competitor_products_clean') > 0,
    'UPDATE competitor_products_clean SET sales_tier = CASE WHEN units IS NULL THEN ''UNKNOWN'' WHEN units >= 100 THEN ''A'' WHEN units >= 50 THEN ''B'' WHEN units >= 15 THEN ''C'' ELSE ''D'' END',
    'SELECT ''competitor_products_clean missing'''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
