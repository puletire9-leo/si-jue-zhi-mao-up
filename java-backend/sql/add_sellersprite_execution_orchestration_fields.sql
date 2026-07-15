-- =================================================================
-- 卖家精灵统一执行编排字段
-- 覆盖请求中心运行/子项和调用审计，幂等可重跑。
-- 执行前请先执行 create_sellersprite_request_center_tables.sql（首次建表场景）。
-- =================================================================

SET @schema_name = DATABASE();

-- sellersprite_request_run
SET @sql = IF((SELECT COUNT(1) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='sellersprite_request_run' AND COLUMN_NAME='idempotency_key')=0,
    'ALTER TABLE sellersprite_request_run ADD COLUMN idempotency_key VARCHAR(128) NULL COMMENT ''活跃任务幂等键，防止迁移期重复扣费'' AFTER source_task_id',
    'SELECT ''sellersprite_request_run.idempotency_key exists''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(1) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='sellersprite_request_run' AND COLUMN_NAME='system_pause_reason')=0,
    'ALTER TABLE sellersprite_request_run ADD COLUMN system_pause_reason VARCHAR(512) NULL COMMENT ''系统门禁/熔断/结果未知导致的自动暂停原因'' AFTER last_error_message',
    'SELECT ''sellersprite_request_run.system_pause_reason exists''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(1) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='sellersprite_request_run' AND COLUMN_NAME='system_resume_at')=0,
    'ALTER TABLE sellersprite_request_run ADD COLUMN system_resume_at DATETIME NULL COMMENT ''预计允许恢复执行时间；为空时需人工确认'' AFTER system_pause_reason',
    'SELECT ''sellersprite_request_run.system_resume_at exists''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(1) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='sellersprite_request_run' AND INDEX_NAME='idx_req_run_idempotency_status')=0,
    'ALTER TABLE sellersprite_request_run ADD KEY idx_req_run_idempotency_status (idempotency_key, status)',
    'SELECT ''sellersprite_request_run.idx_req_run_idempotency_status exists''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sellersprite_request_item
SET @sql = IF((SELECT COUNT(1) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='sellersprite_request_item' AND COLUMN_NAME='payload_json')=0,
    'ALTER TABLE sellersprite_request_item ADD COLUMN payload_json TEXT NULL COMMENT ''显式请求载荷 JSON'' AFTER asin_list',
    'SELECT ''sellersprite_request_item.payload_json exists''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(1) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='sellersprite_request_item' AND COLUMN_NAME='attempt_count')=0,
    'ALTER TABLE sellersprite_request_item ADD COLUMN attempt_count INT NOT NULL DEFAULT 0 COMMENT ''已执行尝试次数'' AFTER error_message',
    'SELECT ''sellersprite_request_item.attempt_count exists''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(1) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='sellersprite_request_item' AND COLUMN_NAME='next_retry_at')=0,
    'ALTER TABLE sellersprite_request_item ADD COLUMN next_retry_at DATETIME NULL COMMENT ''允许自动重试的最早时间'' AFTER attempt_count',
    'SELECT ''sellersprite_request_item.next_retry_at exists''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(1) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='sellersprite_request_item' AND COLUMN_NAME='last_attempt_at')=0,
    'ALTER TABLE sellersprite_request_item ADD COLUMN last_attempt_at DATETIME NULL COMMENT ''最近一次外部调用尝试时间'' AFTER next_retry_at',
    'SELECT ''sellersprite_request_item.last_attempt_at exists''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(1) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='sellersprite_request_item' AND COLUMN_NAME='error_code')=0,
    'ALTER TABLE sellersprite_request_item ADD COLUMN error_code VARCHAR(32) NULL COMMENT ''结构化错误代码'' AFTER last_attempt_at',
    'SELECT ''sellersprite_request_item.error_code exists''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(1) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='sellersprite_request_item' AND COLUMN_NAME='error_summary')=0,
    'ALTER TABLE sellersprite_request_item ADD COLUMN error_summary VARCHAR(512) NULL COMMENT ''脱敏并截断的原始错误摘要'' AFTER error_code',
    'SELECT ''sellersprite_request_item.error_summary exists''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(1) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='sellersprite_request_item' AND COLUMN_NAME='request_dispatched')=0,
    'ALTER TABLE sellersprite_request_item ADD COLUMN request_dispatched TINYINT(1) NOT NULL DEFAULT 0 COMMENT ''HTTP 请求是否已真实发出'' AFTER error_summary',
    'SELECT ''sellersprite_request_item.request_dispatched exists''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(1) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='sellersprite_request_item' AND COLUMN_NAME='usage_confirmed')=0,
    'ALTER TABLE sellersprite_request_item ADD COLUMN usage_confirmed TINYINT(1) NOT NULL DEFAULT 0 COMMENT ''是否确认卖家精灵已消耗使用次数'' AFTER request_dispatched',
    'SELECT ''sellersprite_request_item.usage_confirmed exists''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- competitor_lookup_log：保持旧日志兼容，同时作为统一外部调用审计。
SET @sql = IF((SELECT COUNT(1) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='competitor_lookup_log' AND COLUMN_NAME='run_id')=0,
    'ALTER TABLE competitor_lookup_log ADD COLUMN run_id VARCHAR(64) NULL AFTER error_message',
    'SELECT ''competitor_lookup_log.run_id exists''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(1) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='competitor_lookup_log' AND COLUMN_NAME='item_id')=0,
    'ALTER TABLE competitor_lookup_log ADD COLUMN item_id BIGINT NULL AFTER run_id',
    'SELECT ''competitor_lookup_log.item_id exists''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(1) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='competitor_lookup_log' AND COLUMN_NAME='request_type')=0,
    'ALTER TABLE competitor_lookup_log ADD COLUMN request_type VARCHAR(32) NULL AFTER item_id',
    'SELECT ''competitor_lookup_log.request_type exists''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(1) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='competitor_lookup_log' AND COLUMN_NAME='request_scope')=0,
    'ALTER TABLE competitor_lookup_log ADD COLUMN request_scope VARCHAR(512) NULL COMMENT ''脱敏请求范围摘要'' AFTER request_type',
    'SELECT ''competitor_lookup_log.request_scope exists''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(1) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='competitor_lookup_log' AND COLUMN_NAME='attempt_no')=0,
    'ALTER TABLE competitor_lookup_log ADD COLUMN attempt_no INT NULL AFTER request_scope',
    'SELECT ''competitor_lookup_log.attempt_no exists''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(1) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='competitor_lookup_log' AND COLUMN_NAME='request_dispatched')=0,
    'ALTER TABLE competitor_lookup_log ADD COLUMN request_dispatched TINYINT(1) NOT NULL DEFAULT 0 AFTER attempt_no',
    'SELECT ''competitor_lookup_log.request_dispatched exists''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(1) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='competitor_lookup_log' AND COLUMN_NAME='usage_confirmed')=0,
    'ALTER TABLE competitor_lookup_log ADD COLUMN usage_confirmed TINYINT(1) NOT NULL DEFAULT 0 AFTER request_dispatched',
    'SELECT ''competitor_lookup_log.usage_confirmed exists''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(1) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='competitor_lookup_log' AND COLUMN_NAME='error_code')=0,
    'ALTER TABLE competitor_lookup_log ADD COLUMN error_code VARCHAR(32) NULL AFTER usage_confirmed',
    'SELECT ''competitor_lookup_log.error_code exists''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(1) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='competitor_lookup_log' AND COLUMN_NAME='error_summary')=0,
    'ALTER TABLE competitor_lookup_log ADD COLUMN error_summary VARCHAR(512) NULL AFTER error_code',
    'SELECT ''competitor_lookup_log.error_summary exists''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(1) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='competitor_lookup_log' AND INDEX_NAME='idx_competitor_lookup_log_run_item')=0,
    'ALTER TABLE competitor_lookup_log ADD KEY idx_competitor_lookup_log_run_item (run_id, item_id)',
    'SELECT ''competitor_lookup_log.idx_competitor_lookup_log_run_item exists''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(1) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='competitor_lookup_log' AND INDEX_NAME='idx_competitor_lookup_log_request_type_created')=0,
    'ALTER TABLE competitor_lookup_log ADD KEY idx_competitor_lookup_log_request_type_created (request_type, created_at)',
    'SELECT ''competitor_lookup_log.idx_competitor_lookup_log_request_type_created exists''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 旧日志没有确认字段；历史 API 成功记录仍必须计入月度用量，避免迁移后错误放开额度。
UPDATE competitor_lookup_log
SET request_dispatched = 1,
    usage_confirmed = 1
WHERE api_status = 'OK'
  AND (request_dispatched = 0 OR usage_confirmed = 0);
