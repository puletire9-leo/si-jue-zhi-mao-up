-- Add m01_active flags used by shop method ranking.
-- Idempotent for MySQL 8.x. Run in the target application database.

SET @schema_name := DATABASE();

SET @sql := IF(
    (SELECT COUNT(1) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @schema_name
       AND TABLE_NAME = 'competitor_products'
       AND COLUMN_NAME = 'm01_active') = 0,
    'ALTER TABLE competitor_products ADD COLUMN m01_active TINYINT NOT NULL DEFAULT 0 COMMENT ''M01 active hit flag: 1=current qualified new product, 0=not active'' AFTER is_current',
    'SELECT ''competitor_products.m01_active exists'''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
    (SELECT COUNT(1) FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = @schema_name
       AND TABLE_NAME = 'competitor_products'
       AND INDEX_NAME = 'idx_m01_active_seller') = 0,
    'CREATE INDEX idx_m01_active_seller ON competitor_products (marketplace, m01_active, seller_name)',
    'SELECT ''idx_m01_active_seller exists'''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
    (SELECT COUNT(1) FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = @schema_name
       AND TABLE_NAME = 'competitor_products'
       AND INDEX_NAME = 'idx_m01_active_avail') = 0,
    'CREATE INDEX idx_m01_active_avail ON competitor_products (m01_active, available_date)',
    'SELECT ''idx_m01_active_avail exists'''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
    (SELECT COUNT(1) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @schema_name
       AND TABLE_NAME = 'competitor_products_clean'
       AND COLUMN_NAME = 'm01_active') = 0,
    'ALTER TABLE competitor_products_clean ADD COLUMN m01_active TINYINT NOT NULL DEFAULT 0 COMMENT ''M01 active hit flag copied by parent group'' AFTER is_current',
    'SELECT ''competitor_products_clean.m01_active exists'''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
    (SELECT COUNT(1) FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = @schema_name
       AND TABLE_NAME = 'competitor_products_clean'
       AND INDEX_NAME = 'idx_m01_active_seller_clean') = 0,
    'CREATE INDEX idx_m01_active_seller_clean ON competitor_products_clean (marketplace, m01_active, seller_name)',
    'SELECT ''idx_m01_active_seller_clean exists'''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
    (SELECT COUNT(1) FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = @schema_name
       AND TABLE_NAME = 'competitor_products_clean'
       AND INDEX_NAME = 'idx_m01_active_avail_clean') = 0,
    'CREATE INDEX idx_m01_active_avail_clean ON competitor_products_clean (m01_active, available_date)',
    'SELECT ''idx_m01_active_avail_clean exists'''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
