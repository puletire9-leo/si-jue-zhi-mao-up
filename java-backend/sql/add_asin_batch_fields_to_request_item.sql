-- =================================================================
-- 卖家精灵请求中心补齐 ASIN 批量查询字段
-- 背景：ASIN_BATCH_LOOKUP 类型需要子项承载 40 个 ASIN 的批次载荷，
--       且需要关联来源初筛任务，现有 seller_name 粒度不适用。
-- 幂等可重跑：全部 information_schema 守卫。
-- =================================================================

SET @schema_name = DATABASE();

-- run 表记录来源任务并建立索引，后端以此保证同一来源只有一个活跃请求任务。
SET @sql = IF(
    (SELECT COUNT(1) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @schema_name
       AND TABLE_NAME = 'sellersprite_request_run'
       AND COLUMN_NAME = 'source_task_id') = 0,
    'ALTER TABLE sellersprite_request_run
     ADD COLUMN source_task_id BIGINT NULL COMMENT ''来源初筛任务 ID（ASIN_BATCH_LOOKUP 幂等键）'' AFTER trigger_ref',
    'SELECT ''sellersprite_request_run.source_task_id exists'''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(1) FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = @schema_name
       AND TABLE_NAME = 'sellersprite_request_run'
       AND INDEX_NAME = 'idx_req_run_source_status') = 0,
    'ALTER TABLE sellersprite_request_run
     ADD KEY idx_req_run_source_status (source_task_id, status)',
    'SELECT ''sellersprite_request_run.idx_req_run_source_status exists'''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(1) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @schema_name
       AND TABLE_NAME = 'sellersprite_request_item'
       AND COLUMN_NAME = 'source_task_id') = 0,
    'ALTER TABLE sellersprite_request_item
     ADD COLUMN source_task_id BIGINT NULL COMMENT ''来源初筛任务ID (asin_import_tasks.id)'' AFTER trigger_id',
    'SELECT ''sellersprite_request_item.source_task_id exists'''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(1) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @schema_name
       AND TABLE_NAME = 'sellersprite_request_item'
       AND COLUMN_NAME = 'asin_list') = 0,
    'ALTER TABLE sellersprite_request_item
     ADD COLUMN asin_list TEXT NULL COMMENT ''ASIN 批次载荷: JSON 数组, 最多 40 个 ASIN(请求中心消费时解析)'' AFTER source_task_id',
    'SELECT ''sellersprite_request_item.asin_list exists'''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 使 seller_name 可为空（ASIN 类型子项没有卖家概念）
SET @sql = IF(
    (SELECT IS_NULLABLE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @schema_name
       AND TABLE_NAME = 'sellersprite_request_item'
       AND COLUMN_NAME = 'seller_name') = 'NO',
    'ALTER TABLE sellersprite_request_item
     MODIFY COLUMN seller_name VARCHAR(255) NULL COMMENT ''店铺名（ASIN 类型子项为空）''',
    'SELECT ''sellersprite_request_item.seller_name already nullable'''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
