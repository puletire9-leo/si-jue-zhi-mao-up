CREATE TABLE IF NOT EXISTS `developer_selection_batch` (
    `id` BIGINT NOT NULL,
    `user_id` BIGINT NOT NULL COMMENT '开发用户ID',
    `developer_name` VARCHAR(100) NOT NULL COMMENT '开发姓名/用户名标签',
    `bucket` VARCHAR(10) NOT NULL COMMENT 'GOOD/BAD',
    `batch_name` VARCHAR(50) NOT NULL COMMENT '人工批次名称',
    `batch_date` DATE NOT NULL COMMENT '批次创建日期',
    `deleted` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '逻辑删除：0正常，1删除',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_developer_bucket_batch` (`user_id`, `bucket`, `batch_name`, `deleted`),
    KEY `idx_batch_scope` (`user_id`, `bucket`, `deleted`, `batch_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='开发个人人工选品批次（好品/差品独立）';

CREATE TABLE IF NOT EXISTS `developer_selection_library` (
    `id` BIGINT NOT NULL,
    `user_id` BIGINT NOT NULL COMMENT '开发用户ID',
    `developer_name` VARCHAR(100) NOT NULL COMMENT '开发姓名/用户名标签',
    `marketplace` VARCHAR(10) NOT NULL,
    `asin` VARCHAR(20) NOT NULL,
    `bucket` VARCHAR(10) NOT NULL COMMENT 'GOOD/BAD',
    `batch_id` BIGINT DEFAULT NULL COMMENT '人工批次ID，NULL为未分类',
    `origin_scene` VARCHAR(32) DEFAULT NULL COMMENT 'NEW_PRODUCTS/REFERENCE_PRODUCTS',
    `origin_source` VARCHAR(100) DEFAULT NULL,
    `snapshot_key` VARCHAR(64) DEFAULT NULL,
    `title` VARCHAR(1000) DEFAULT NULL,
    `brand` VARCHAR(255) DEFAULT NULL,
    `image_url` VARCHAR(1000) DEFAULT NULL,
    `price` DECIMAL(12,2) DEFAULT NULL,
    `units` INT DEFAULT NULL,
    `bsr` INT DEFAULT NULL,
    `ratings` INT DEFAULT NULL,
    `rating` DECIMAL(4,2) DEFAULT NULL,
    `listing_days` INT DEFAULT NULL,
    `weight_g` DECIMAL(12,2) DEFAULT NULL,
    `seller_name` VARCHAR(255) DEFAULT NULL,
    `node_label_path` VARCHAR(2000) DEFAULT NULL,
    `product_url` VARCHAR(1000) DEFAULT NULL,
    `snapshot_json` LONGTEXT DEFAULT NULL COMMENT '加入时商品完整快照',
    `deleted` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '逻辑删除：0正常，1删除',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_developer_marketplace_asin` (`user_id`, `marketplace`, `asin`),
    KEY `idx_developer_bucket` (`user_id`, `bucket`, `deleted`, `updated_at`),
    KEY `idx_developer_bucket_batch` (`user_id`, `bucket`, `batch_id`, `deleted`),
    KEY `idx_admin_bucket` (`bucket`, `marketplace`, `deleted`, `updated_at`),
    KEY `idx_marketplace_asin` (`marketplace`, `asin`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='开发个人人工选品库（好品/差品）';

-- 兼容曾执行过早期建表脚本、但还没有逻辑删除列的环境。
SET @dsl_deleted_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'developer_selection_library'
      AND COLUMN_NAME = 'deleted'
);
SET @dsl_deleted_sql = IF(
    @dsl_deleted_exists = 0,
    'ALTER TABLE `developer_selection_library` ADD COLUMN `deleted` TINYINT(1) NOT NULL DEFAULT 0 COMMENT ''逻辑删除：0正常，1删除'' AFTER `snapshot_json`',
    'SELECT 1'
);
PREPARE dsl_deleted_stmt FROM @dsl_deleted_sql;
EXECUTE dsl_deleted_stmt;
DEALLOCATE PREPARE dsl_deleted_stmt;

SET @dsl_batch_id_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'developer_selection_library'
      AND COLUMN_NAME = 'batch_id'
);
SET @dsl_batch_id_sql = IF(
    @dsl_batch_id_exists = 0,
    'ALTER TABLE `developer_selection_library` ADD COLUMN `batch_id` BIGINT DEFAULT NULL COMMENT ''人工批次ID，NULL为未分类'' AFTER `bucket`',
    'SELECT 1'
);
PREPARE dsl_batch_id_stmt FROM @dsl_batch_id_sql;
EXECUTE dsl_batch_id_stmt;
DEALLOCATE PREPARE dsl_batch_id_stmt;

SET @dsl_batch_index_exists = (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'developer_selection_library'
      AND INDEX_NAME = 'idx_developer_bucket_batch'
);
SET @dsl_batch_index_sql = IF(
    @dsl_batch_index_exists = 0,
    'ALTER TABLE `developer_selection_library` ADD INDEX `idx_developer_bucket_batch` (`user_id`, `bucket`, `batch_id`, `deleted`)',
    'SELECT 1'
);
PREPARE dsl_batch_index_stmt FROM @dsl_batch_index_sql;
EXECUTE dsl_batch_index_stmt;
DEALLOCATE PREPARE dsl_batch_index_stmt;
