-- 补登记首次精品导入：旧版本已完成请求，但当时未生成 asin_import_tasks 可见记录。
SET @existing_task_id = (
    SELECT source_task_id
    FROM sellersprite_request_run
    WHERE run_id = 'REQ_c8a89b653e2b'
    LIMIT 1
);

INSERT INTO asin_import_tasks (
    marketplace, import_type, task_status,
    total_count, pass_count, price_fail_count, review_fail_count, duplicate_count, skip_count,
    batch_total, batch_current, api_success, api_fail, api_requests_used,
    data_month, bazhuayu_mapping_id, bazhuayu_task_id, task_name, task_category,
    initial_filter, target_table, progress_log, created_at, updated_at
)
SELECT
    'US', 'BAZHUAYU_AUTO', 'READY',
    1281, 1087, 0, 0, 194, 0,
    28, 28, 28, 0, 28,
    '202607', 7, '2dba8ede-1efa-40f3-ad59-099c17512d4f',
    CONVERT(0xe7be8ee59bbde6a69ce58d95e98787e99b86e7b2bee59381 USING utf8mb4),
    CONVERT(0xe7b2bee59381 USING utf8mb4),
    0, 'premium_products',
    CONVERT(0xe58e86e58fb2e8a1a5e799bbe8aeb0efbc9ae9a696e6aca1e7b2bee59381e5afbce585a5e5b7b2e5ae8ce68890 USING utf8mb4),
    '2026-07-15 17:46:40', '2026-07-15 17:47:40'
WHERE @existing_task_id IS NULL;

SET @visible_task_id = IF(@existing_task_id IS NULL, LAST_INSERT_ID(), @existing_task_id);

UPDATE sellersprite_request_run
SET source_task_id = @visible_task_id,
    trigger_ref = JSON_SET(
        COALESCE(trigger_ref, JSON_OBJECT()),
        '$.sourceTaskId', @visible_task_id,
        '$.taskCategory', CONVERT(0xe7b2bee59381 USING utf8mb4),
        '$.initialFilter', FALSE,
        '$.targetTable', 'premium_products'
    )
WHERE run_id = 'REQ_c8a89b653e2b';
