-- =================================================================
-- 领星请求中心：lingxing_request_task
-- =================================================================
-- 职责：领星开放平台调用的统一任务入口。一个任务 = 一次领星调用，
--       由按 task_type 注册的 LingxingTaskHandler 消费执行。
-- 与卖家精灵请求中心（run + item 两级）不同，这里是单表任务模型：
--   PENDING → RUNNING → SUCCESS / FAILED；任意活跃态可 STOPPED。
-- 幂等可重跑：CREATE TABLE IF NOT EXISTS。
-- charset utf8mb4_unicode_ci，与其它 lingxing_* 表一致。
-- =================================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS lingxing_request_task (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键',
    task_id VARCHAR(64) NOT NULL COMMENT '业务任务号 LX_xxxxxxxxxxxx',
    task_type VARCHAR(64) NOT NULL COMMENT '任务类型，对应 LingxingTaskHandler.taskType()',
    registry_id BIGINT NULL COMMENT '来源自动化请求注册项 ID',
    registration_code VARCHAR(64) NULL COMMENT '来源自动化请求注册编码',
    account_key VARCHAR(128) NULL COMMENT '账号维度（领星 AppId），客户端按此串行化',
    priority INT NOT NULL DEFAULT 0 COMMENT '队列优先级，数值越大越先执行',
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING/RUNNING/SUCCESS/FAILED/STOPPED',
    payload_json TEXT NULL COMMENT '任务载荷 JSON，处理器自行解析',
    result_json TEXT NULL COMMENT '任务结果摘要 JSON（成功时写入）',
    error_message VARCHAR(512) NULL COMMENT '任务级错误信息',
    attempt_count INT NOT NULL DEFAULT 0 COMMENT '已执行尝试次数',
    next_retry_at DATETIME NULL COMMENT '允许自动重试的最早时间（当前版不自动重试，保留字段）',
    operator VARCHAR(64) NULL COMMENT '操作人',
    started_at DATETIME NULL COMMENT '任务开始时间',
    finished_at DATETIME NULL COMMENT '任务结束时间',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    UNIQUE KEY uk_lingxing_req_task_id (task_id),
    KEY idx_lingxing_req_type (task_type, status),
    KEY idx_lingxing_req_registry (registry_id, status),
    KEY idx_lingxing_req_status (status, id),
    KEY idx_lingxing_req_account (account_key, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='领星请求中心：统一任务';
