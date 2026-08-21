-- Data processing center + automation center foundation.
-- Apply before deploying Java entities; SchemaGuard requires these tables.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS automation_job (
    id BIGINT NOT NULL PRIMARY KEY COMMENT 'Snowflake ID',
    job_code VARCHAR(64) NOT NULL COMMENT 'Registered AutomationJob code',
    job_name VARCHAR(128) NOT NULL COMMENT 'Display name',
    description VARCHAR(512) NULL COMMENT 'Purpose and ownership',
    enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT '0 disabled, 1 enabled',
    schedule_type VARCHAR(24) NOT NULL DEFAULT 'MANUAL' COMMENT 'MANUAL/CRON/FIXED_DELAY',
    cron_expression VARCHAR(64) NULL COMMENT 'Spring six-field cron expression',
    fixed_delay_seconds INT NULL COMMENT 'Delay from previous completion',
    parameters_json JSON NULL COMMENT 'Default job parameters',
    next_run_at DATETIME NULL COMMENT 'Next scheduler pickup time',
    last_run_at DATETIME NULL COMMENT 'Last completed attempt time',
    deleted TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Logical delete',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_automation_job_code (job_code),
    KEY idx_automation_job_due (enabled, deleted, next_run_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Automation center job configuration';

CREATE TABLE IF NOT EXISTS automation_run (
    id BIGINT NOT NULL PRIMARY KEY COMMENT 'Snowflake ID',
    run_no VARCHAR(32) NOT NULL COMMENT 'External run identifier',
    job_code VARCHAR(64) NOT NULL,
    trigger_type VARCHAR(24) NOT NULL COMMENT 'MANUAL/SCHEDULED/EVENT/RETRY',
    requested_by VARCHAR(128) NOT NULL DEFAULT 'system',
    correlation_id VARCHAR(128) NULL,
    status VARCHAR(24) NOT NULL COMMENT 'RUNNING/SUCCESS/PARTIAL_SUCCESS/FAILED',
    request_json JSON NULL,
    result_json JSON NULL,
    total_count BIGINT NOT NULL DEFAULT 0,
    success_count BIGINT NOT NULL DEFAULT 0,
    failed_count BIGINT NOT NULL DEFAULT 0,
    skipped_count BIGINT NOT NULL DEFAULT 0,
    error_message VARCHAR(1000) NULL,
    started_at DATETIME NOT NULL,
    finished_at DATETIME NULL,
    deleted TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_automation_run_no (run_no),
    KEY idx_automation_run_job_time (job_code, started_at),
    KEY idx_automation_run_status_time (status, started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Automation center execution audit';

CREATE TABLE IF NOT EXISTS automation_record_binding (
    id BIGINT NOT NULL PRIMARY KEY COMMENT 'Snowflake ID',
    job_code VARCHAR(64) NOT NULL,
    business_key VARCHAR(191) NOT NULL COMMENT 'Stable source business identity',
    target_type VARCHAR(32) NOT NULL COMMENT 'FEISHU/HTTP/DB/etc',
    target_resource VARCHAR(191) NOT NULL COMMENT 'Base/table/topic/resource identifier',
    target_record_id VARCHAR(191) NOT NULL COMMENT 'Destination record identifier',
    last_source_hash VARCHAR(64) NULL COMMENT 'Skip unchanged payloads',
    last_business_status VARCHAR(64) NULL,
    terminal TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 means final state; stop routine refresh',
    last_synced_at DATETIME NULL,
    deleted TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_automation_binding (job_code, business_key, target_type, target_resource),
    KEY idx_automation_binding_active (job_code, terminal, deleted),
    KEY idx_automation_binding_target (target_type, target_resource, target_record_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Source business key to destination record binding';
