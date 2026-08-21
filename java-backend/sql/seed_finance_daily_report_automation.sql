-- 财务日报自动化任务注册与排期
-- 依赖 create_data_processing_automation_center.sql 和 create_lingxing_automation_request_registry.sql

SET NAMES utf8mb4;

-- 1. 在 automation_job 中注册任务（业务调度由领星请求注册表控制）
INSERT INTO automation_job (
    id, job_code, job_name, description,
    enabled, schedule_type, cron_expression, fixed_delay_seconds,
    parameters_json, next_run_at
) VALUES (
    202608170002, 'FINANCE_DAILY_REPORT', '领星财务日报',
    '拉取领星单日产品表现，按工作簿公式生成总/运营/开发/非标品/上架时间 5 维度日报并幂等写入飞书',
    1, 'MANUAL', NULL, NULL,
    JSON_OBJECT('reportDate', NULL),
    NULL
) ON DUPLICATE KEY UPDATE
    job_name=VALUES(job_name),
    description=VALUES(description),
    schedule_type=VALUES(schedule_type),
    cron_expression=VALUES(cron_expression),
    fixed_delay_seconds=VALUES(fixed_delay_seconds),
    updated_at=CURRENT_TIMESTAMP;

-- 2. 在领星请求注册表中登记每天 10:00 排期
INSERT INTO lingxing_automation_request_registry (
    id, registration_code, automation_job_code, task_type, task_name,
    enabled, schedule_type, run_time, timezone, priority,
    slot_group, slot_order, minimum_gap_seconds, payload_template_json,
    retry_limit, remark
) VALUES (
    202608170002, 'FINANCE_DAILY_REPORT_DAILY',
    'FINANCE_DAILY_REPORT',
    'FINANCE_DAILY_REPORT', '财务日报（每日）',
    1, 'DAILY', '10:00:00', 'Asia/Shanghai', 90,
    'FINANCE_REPORT', 0, 60,
    JSON_OBJECT('reportDate', NULL), 0,
    '每天 10:00 自动更新；默认 reportDate 为空，由任务处理为昨天。所有领星请求统一进入领星运行中心'
) ON DUPLICATE KEY UPDATE
    task_name=VALUES(task_name),
    enabled=VALUES(enabled),
    schedule_type=VALUES(schedule_type),
    run_time=VALUES(run_time),
    payload_template_json=VALUES(payload_template_json),
    remark=VALUES(remark),
    updated_at=CURRENT_TIMESTAMP;

UPDATE lingxing_automation_request_registry
SET next_run_at=TIMESTAMP(
        DATE_ADD(DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR)),
                 INTERVAL IF(TIME(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR)) >= '10:00:00', 1, 0) DAY),
        '10:00:00'),
    last_status=COALESCE(last_status, 'SCHEDULED'),
    updated_at=CURRENT_TIMESTAMP
WHERE registration_code='FINANCE_DAILY_REPORT_DAILY'
  AND enabled=1
  AND (next_run_at IS NULL OR next_run_at <= DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR));
