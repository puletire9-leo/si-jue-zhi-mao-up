-- 默认注册项：先注册、默认停用，验证领星账号和飞书目标后再启用。

UPDATE automation_job
SET enabled=1, schedule_type='MANUAL', cron_expression=NULL,
    fixed_delay_seconds=NULL, next_run_at=NULL,
    updated_at=CURRENT_TIMESTAMP
WHERE job_code='OPERATIONS_LOGISTICS_PURCHASE_PROGRESS';

INSERT INTO lingxing_automation_request_registry (
    id, registration_code, automation_job_code, task_type, task_name,
    enabled, schedule_type, run_time, timezone, priority,
    slot_group, slot_order, minimum_gap_seconds, payload_template_json,
    retry_limit, remark
) VALUES (
    202608170001, 'OPS_LOGISTICS_DAILY',
    'OPERATIONS_LOGISTICS_PURCHASE_PROGRESS',
    'OPERATIONS_LOGISTICS_PURCHASE_PROGRESS', '运营物流采购进度（每日）',
    0, 'DAILY', '02:10:00', 'Asia/Shanghai', 100,
    'OPERATIONS_LOGISTICS', 0, 60,
    JSON_OBJECT('syncShipments', TRUE), 0,
    '确认领星账号、飞书权限和测试结果后，将 enabled 改为 1'
) ON DUPLICATE KEY UPDATE
    task_name=VALUES(task_name), schedule_type=VALUES(schedule_type),
    run_time=VALUES(run_time), payload_template_json=VALUES(payload_template_json),
    remark=VALUES(remark),
    updated_at=CURRENT_TIMESTAMP;
