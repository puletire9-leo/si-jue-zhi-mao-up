-- 领星自动化请求注册表：只负责登记排期，不直接请求领星。
-- 实际请求统一写入 lingxing_request_task，由单线程 worker 执行。

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS lingxing_automation_request_registry (
    id BIGINT NOT NULL PRIMARY KEY COMMENT '雪花 ID',
    registration_code VARCHAR(64) NOT NULL COMMENT '唯一注册编码',
    automation_job_code VARCHAR(64) NOT NULL COMMENT '关联 automation_job.job_code',
    task_type VARCHAR(64) NOT NULL COMMENT '对应 LingxingTaskHandler.taskType()',
    task_name VARCHAR(128) NOT NULL COMMENT '请求任务名称',
    enabled TINYINT(1) NOT NULL DEFAULT 0 COMMENT '0 停用，1 启用',
    schedule_type VARCHAR(24) NOT NULL DEFAULT 'MANUAL' COMMENT 'MANUAL/DAILY/WEEKLY/FIXED_DELAY',
    run_time TIME NULL COMMENT '每日/每周基准执行时间',
    day_of_week TINYINT NULL COMMENT 'ISO 星期 1-7，仅 WEEKLY 使用',
    fixed_delay_seconds INT NULL COMMENT '固定延迟秒数，仅 FIXED_DELAY 使用',
    timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Shanghai',
    priority INT NOT NULL DEFAULT 0 COMMENT '生成请求任务的队列优先级',
    slot_group VARCHAR(64) NOT NULL DEFAULT 'DEFAULT' COMMENT '错峰分组',
    slot_order INT NOT NULL DEFAULT 0 COMMENT '同组槽位序号，从 0 开始',
    minimum_gap_seconds INT NOT NULL DEFAULT 60 COMMENT '槽位间最小间隔',
    payload_template_json JSON NULL COMMENT '生成 lingxing_request_task 时使用的载荷模板',
    next_run_at DATETIME NULL COMMENT '下一次生成请求任务时间',
    last_enqueued_at DATETIME NULL,
    last_task_id VARCHAR(64) NULL,
    last_status VARCHAR(32) NULL COMMENT 'SCHEDULED/PENDING/RUNNING/SUCCESS/FAILED/DISABLED',
    last_error VARCHAR(512) NULL,
    retry_limit INT NOT NULL DEFAULT 0,
    remark VARCHAR(512) NULL,
    deleted TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_lingxing_auto_registry_code (registration_code),
    KEY idx_lingxing_auto_registry_due (enabled, deleted, next_run_at, priority),
    KEY idx_lingxing_auto_registry_job (automation_job_code, enabled, deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='领星自动化请求注册与排期';

SET @ddl = IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='lingxing_request_task'
             AND COLUMN_NAME='registry_id'),
    'SELECT 1',
    'ALTER TABLE lingxing_request_task ADD COLUMN registry_id BIGINT NULL COMMENT ''来源自动化请求注册项 ID'''
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='lingxing_request_task'
             AND COLUMN_NAME='registration_code'),
    'SELECT 1',
    'ALTER TABLE lingxing_request_task ADD COLUMN registration_code VARCHAR(64) NULL COMMENT ''来源自动化请求注册编码'''
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='lingxing_request_task'
             AND COLUMN_NAME='priority'),
    'SELECT 1',
    'ALTER TABLE lingxing_request_task ADD COLUMN priority INT NOT NULL DEFAULT 0 COMMENT ''队列优先级'''
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF(
    EXISTS(SELECT 1 FROM information_schema.STATISTICS
           WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='lingxing_request_task'
             AND INDEX_NAME='idx_lingxing_req_registry'),
    'SELECT 1',
    'CREATE INDEX idx_lingxing_req_registry ON lingxing_request_task (registry_id, status)'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
