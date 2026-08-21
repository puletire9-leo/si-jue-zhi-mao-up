-- =================================================================
-- Lingxing 同步游标表
-- 2026-08-17
--
-- Purpose:
--   记录各数据类型的增量同步游标，避免每次全量请求
-- =================================================================

CREATE TABLE IF NOT EXISTS `lingxing_sync_cursor` (
    `id`                 BIGINT       NOT NULL AUTO_INCREMENT COMMENT 'Primary key',
    `data_type`          VARCHAR(64)  NOT NULL COMMENT '数据类型: PURCHASE_ORDER/PURCHASE_PLAN/INVENTORY_BATCH/SP_ACTUAL/SP_PLAN',
    `last_success_time`  DATETIME     NOT NULL COMMENT '最后成功同步时间',
    `last_run_id`        VARCHAR(64)  DEFAULT NULL COMMENT '最后运行ID',
    `sync_count`         BIGINT       NOT NULL DEFAULT 0 COMMENT '累计同步次数',
    `last_record_count`  INT          NOT NULL DEFAULT 0 COMMENT '最后一次记录数',
    `created_at`         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Created time',
    `updated_at`         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Updated time',

    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_data_type` (`data_type`),
    KEY `idx_last_success_time` (`last_success_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Lingxing sync cursor';
