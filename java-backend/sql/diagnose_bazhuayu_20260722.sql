-- =====================================================================
-- 7.22 八爪鱼导入异常诊断（只读，不改任何数据）
-- 用途：定位 (1) 新品榜是否被批次幂等 SKIP  (2) 精品榜历史行是否被 upsert 改嫁
-- =====================================================================

-- ---------------------------------------------------------------------
-- [1] 新品榜：7.22 到底有没有建任务？建了是不是空任务？
--     - 若近几批里看不到 target_table=competitor_products 的 7.22 新行 → 幂等 SKIP（根本没建）
--     - 若有 7.22 新行但 total_count=0 → 云端返回 0 页
-- ---------------------------------------------------------------------
SELECT id, bazhuayu_mapping_id, bazhuayu_task_id, bazhuayu_batch_no,
       target_table, task_status, total_count, pass_count,
       created_at, updated_at
FROM asin_import_tasks
WHERE import_type = 'BAZHUAYU_AUTO'
  AND target_table = 'competitor_products'
ORDER BY id DESC
LIMIT 10;

-- ---------------------------------------------------------------------
-- [2] 同一 (mappingId, batchNo) 是否已存在历史任务（=幂等命中的直接证据）
--     若同一 mapping 出现重复 batchNo，或 7.22 的 batchNo 早已存在于更早的任务 → 就是 SKIP
-- ---------------------------------------------------------------------
SELECT bazhuayu_mapping_id, bazhuayu_batch_no, COUNT(*) AS task_count,
       MIN(created_at) AS first_created, MAX(created_at) AS last_created,
       GROUP_CONCAT(id ORDER BY id) AS task_ids
FROM asin_import_tasks
WHERE import_type = 'BAZHUAYU_AUTO'
  AND bazhuayu_batch_no IS NOT NULL
GROUP BY bazhuayu_mapping_id, bazhuayu_batch_no
HAVING task_count >= 1
ORDER BY last_created DESC
LIMIT 20;

-- ---------------------------------------------------------------------
-- [3] 新品榜 raw：7.22 到底有没有落到 bazhuayu_weekly_raw
-- ---------------------------------------------------------------------
SELECT marketplace,
       DATE(scraped_at) AS day,
       week_tag,
       COUNT(*) AS raw_rows,
       COUNT(DISTINCT asin) AS distinct_asins
FROM bazhuayu_weekly_raw
WHERE scraped_at >= '2026-07-15 00:00:00'
GROUP BY marketplace, DATE(scraped_at), week_tag
ORDER BY day DESC, marketplace;

-- ---------------------------------------------------------------------
-- [4] 精品榜：历史行是否被 7.22 的 upsert 改嫁（核心证据）
--     出现 created_at < 7.22 但 updated_at >= 7.22 的行 = 历史行被覆盖
-- ---------------------------------------------------------------------
SELECT
    SUM(CASE WHEN created_at <  '2026-07-22' AND updated_at >= '2026-07-22'
             THEN 1 ELSE 0 END) AS overwritten_history_rows,
    SUM(CASE WHEN created_at >= '2026-07-22'
             THEN 1 ELSE 0 END) AS truly_new_today_rows,
    COUNT(*) AS total_month_rows
FROM premium_products
WHERE month = '202607'
  AND deleted = 0;

-- ---------------------------------------------------------------------
-- [5] 精品榜：被改嫁的历史行明细（抽样查看，确认损失范围）
-- ---------------------------------------------------------------------
SELECT id, marketplace, asin, month, bazhuayu_mapping_id, bazhuayu_task_id,
       bazhuayu_task_name, week_tag, created_at, updated_at
FROM premium_products
WHERE month = '202607'
  AND deleted = 0
  AND created_at <  '2026-07-22'
  AND updated_at >= '2026-07-22'
ORDER BY created_at ASC
LIMIT 100;

-- ---------------------------------------------------------------------
-- [6] 精品榜：按周分布，直观看出"历史周是否整体归到了本周任务"
-- ---------------------------------------------------------------------
SELECT week_tag,
       bazhuayu_task_name,
       COUNT(*) AS rows_cnt,
       MIN(created_at) AS earliest_created,
       MAX(updated_at) AS latest_updated
FROM premium_products
WHERE month = '202607'
  AND deleted = 0
GROUP BY week_tag, bazhuayu_task_name
ORDER BY week_tag DESC, rows_cnt DESC;
