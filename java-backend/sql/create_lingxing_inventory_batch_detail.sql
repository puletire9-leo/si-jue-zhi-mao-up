-- =================================================================
-- Lingxing inventory batch detail (daily snapshot)
-- 2026-08-11
--
-- Purpose:
--   Daily snapshot of inventory batch detail from Lingxing API
--   (getBatchDetailList). Two key fields:
--     good_num          → >0 means "已入库待发亚马逊"
--     good_transit_num  → >0 means "在途待入库"
--
--   Each row is idempotent by (batch_no, sku, data_date).
--   One SKU can appear in multiple batches, each independently tracked.
-- =================================================================

CREATE TABLE IF NOT EXISTS `lingxing_inventory_batch_detail` (
    `id`                  BIGINT       NOT NULL AUTO_INCREMENT COMMENT 'Primary key',
    `biz_key`             CHAR(64)     NOT NULL COMMENT 'SHA-256(batch_no|sku|data_date)',
    `batch_no`            VARCHAR(64)  NOT NULL COMMENT 'Batch number from Lingxing',
    `sku`                 VARCHAR(128) NOT NULL COMMENT 'SKU',
    `developer`           VARCHAR(64)  DEFAULT NULL COMMENT 'Developer matched by SKU prefix',
    `sku_prefix`          VARCHAR(16)  DEFAULT NULL COMMENT 'SKU prefix used for matching',
    `data_date`           DATE         NOT NULL COMMENT 'Data date (sync date)',
    `good_num`            INT          DEFAULT 0 COMMENT 'Usable quantity (>0 = arrived at warehouse)',
    `good_transit_num`    INT          DEFAULT 0 COMMENT 'Usable in-transit quantity (>0 = in transit)',
    `total_num`           INT          DEFAULT 0 COMMENT 'Total balance (in-transit + in-warehouse)',
    `balance_num`         INT          DEFAULT 0 COMMENT 'In-warehouse balance',
    `transit_balance_num` INT          DEFAULT 0 COMMENT 'In-transit balance',
    `wh_name`             VARCHAR(128) DEFAULT NULL COMMENT 'Warehouse name',
    `type_name`           VARCHAR(64)  DEFAULT NULL COMMENT 'Stock-in type description',
    `purchase_in_time`    VARCHAR(32)  DEFAULT NULL COMMENT 'Stock-in time from Lingxing',
    `purchase_order_sns`  JSON         DEFAULT NULL COMMENT 'Purchase order numbers (array)',
    `plan_sn`             JSON         DEFAULT NULL COMMENT 'Purchase plan numbers (array)',
    `raw_json`            LONGTEXT     DEFAULT NULL COMMENT 'Raw Lingxing API response',
    `synced_at`           DATETIME     DEFAULT CURRENT_TIMESTAMP COMMENT 'Sync time',
    `created_at`          DATETIME     DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation time',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_biz_key` (`biz_key`),
    INDEX `idx_developer` (`developer`),
    INDEX `idx_data_date` (`data_date`),
    INDEX `idx_sku` (`sku`),
    INDEX `idx_batch_no` (`batch_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Daily inventory batch detail snapshot';
