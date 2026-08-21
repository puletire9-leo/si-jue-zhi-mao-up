-- Keep the shipment plan/actual tables aligned with the complete reference Lingxing models.
-- Safe to rerun: each column is added only when absent.

DELIMITER $$
DROP PROCEDURE IF EXISTS add_column_if_missing$$
CREATE PROCEDURE add_column_if_missing(
    IN p_table VARCHAR(64),
    IN p_column VARCHAR(64),
    IN p_definition TEXT
)
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = p_table
          AND column_name = p_column
    ) THEN
        SET @ddl = CONCAT('ALTER TABLE `', p_table, '` ADD COLUMN `', p_column, '` ', p_definition);
        PREPARE stmt FROM @ddl;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END$$
DELIMITER ;

CALL add_column_if_missing('lingxing_shipment_plan', 'product_id', 'BIGINT NULL AFTER product_name');
CALL add_column_if_missing('lingxing_shipment_plan', 'pic_url', 'VARCHAR(500) NULL AFTER product_id');
CALL add_column_if_missing('lingxing_shipment_plan', 'small_image_url', 'VARCHAR(500) NULL AFTER pic_url');
CALL add_column_if_missing('lingxing_shipment_plan', 'nation', 'VARCHAR(50) NULL AFTER sname');
CALL add_column_if_missing('lingxing_shipment_plan', 'packing_type', 'TINYINT NULL AFTER wname');
CALL add_column_if_missing('lingxing_shipment_plan', 'packing_type_name', 'VARCHAR(50) NULL AFTER packing_type');
CALL add_column_if_missing('lingxing_shipment_plan', 'is_relate_mws', 'TINYINT NOT NULL DEFAULT 0 AFTER status_name');
CALL add_column_if_missing('lingxing_shipment_plan', 'batch_remark', 'TEXT NULL AFTER shipment_mws_sn');
CALL add_column_if_missing('lingxing_shipment_plan', 'remark', 'TEXT NULL AFTER batch_remark');
CALL add_column_if_missing('lingxing_shipment_plan', 'create_user', 'VARCHAR(100) NULL AFTER remark');
CALL add_column_if_missing('lingxing_shipment_plan', 'create_time_remote', 'DATETIME NULL AFTER create_user');
CALL add_column_if_missing('lingxing_shipment_plan', 'shipping_method', 'VARCHAR(20) NULL AFTER create_time_remote');
CALL add_column_if_missing('lingxing_shipment_plan', 'local_created_by_user_id', 'BIGINT NULL AFTER shipping_method');
CALL add_column_if_missing('lingxing_shipment_plan', 'local_created_by_username', 'VARCHAR(100) NULL AFTER local_created_by_user_id');
CALL add_column_if_missing('lingxing_shipment_plan', 'local_created_by_nickname', 'VARCHAR(100) NULL AFTER local_created_by_username');
CALL add_column_if_missing('lingxing_shipment_plan', 'local_created_time', 'DATETIME NULL AFTER local_created_by_nickname');

CALL add_column_if_missing('lingxing_shipment_actual', 'wname', 'VARCHAR(255) NULL AFTER logistics_channel_name');
CALL add_column_if_missing('lingxing_shipment_actual', 'wid', 'BIGINT NULL AFTER wname');
CALL add_column_if_missing('lingxing_shipment_actual', 'create_user', 'VARCHAR(100) NULL AFTER expected_arrival_date');
CALL add_column_if_missing('lingxing_shipment_actual', 'create_time_remote', 'VARCHAR(32) NULL AFTER create_user');
CALL add_column_if_missing('lingxing_shipment_actual', 'update_time_remote', 'VARCHAR(32) NULL AFTER create_time_remote');
CALL add_column_if_missing('lingxing_shipment_actual', 'relate_id', 'BIGINT NULL AFTER update_time_remote');
CALL add_column_if_missing('lingxing_shipment_actual', 'num', 'INT NOT NULL DEFAULT 0 AFTER relate_id');
CALL add_column_if_missing('lingxing_shipment_actual', 'apply_num', 'INT NOT NULL DEFAULT 0 AFTER num');
CALL add_column_if_missing('lingxing_shipment_actual', 'sname', 'VARCHAR(255) NULL AFTER apply_num');
CALL add_column_if_missing('lingxing_shipment_actual', 'sid', 'BIGINT NULL AFTER sname');
CALL add_column_if_missing('lingxing_shipment_actual', 'nation', 'VARCHAR(50) NULL AFTER sid');
CALL add_column_if_missing('lingxing_shipment_actual', 'pic_url', 'VARCHAR(500) NULL AFTER nation');
CALL add_column_if_missing('lingxing_shipment_actual', 'asin', 'VARCHAR(50) NULL AFTER pic_url');
CALL add_column_if_missing('lingxing_shipment_actual', 'product_id', 'BIGINT NULL AFTER asin');
CALL add_column_if_missing('lingxing_shipment_actual', 'is_final', 'TINYINT NOT NULL DEFAULT 0 AFTER product_id');

DROP PROCEDURE IF EXISTS add_column_if_missing;
