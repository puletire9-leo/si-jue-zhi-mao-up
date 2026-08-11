-- =================================================================
-- Lingxing developer SKU prefix mapping
-- 2026-08-11
--
-- Purpose:
--   Maps developer name to SKU prefix (first 3 digits of base_sku).
--   Rebuilt weekly after unified table rebuild.
--   One developer can have multiple prefixes (e.g., 刘淼 → 257, 261).
-- =================================================================

CREATE TABLE IF NOT EXISTS `lingxing_developer_sku_prefix` (
    `id`          BIGINT       NOT NULL AUTO_INCREMENT COMMENT 'Primary key',
    `developer`   VARCHAR(64)  NOT NULL COMMENT 'Developer name from unified table',
    `sku_prefix`  VARCHAR(16)  NOT NULL COMMENT 'SKU prefix (first 3 digits of base_sku)',
    `asin_count`  INT          DEFAULT 0 COMMENT 'Number of ASINs with this prefix for this developer',
    `updated_at`  DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last update time',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_dev_prefix` (`developer`, `sku_prefix`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Developer to SKU prefix mapping';
