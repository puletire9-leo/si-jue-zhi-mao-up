-- ============================================================
-- BRS 榜单原始表（brs_ranking_raw）
-- 说明：八爪鱼按 Browse Node(方法二)深分页采集出 ASIN，价格初筛后
--       交卖家精灵请求中心补数，返回字段落入本表。
--       八爪鱼原始字段（标题/价格/链接/图片/配送）只用于「提 ASIN + 价格初筛」，
--       不入库；入库的全是卖家精灵返回字段。
--       表结构镜像 competitor_products，追加榜单批次与溯源列，
--       让选品页用同一套查询/筛选口径读取（杜绝「筛选对不上号」）。
-- ============================================================

-- 1. 从 competitor_products 克隆结构（含全部卖家精灵业务列 + created_at/updated_at）
CREATE TABLE IF NOT EXISTS brs_ranking_raw LIKE competitor_products;

-- 2. 剥离原表按月唯一键。BRS 走「周批次」语义：同一 (站点, ASIN) 每个采集批次各留一行，
--    以便追溯不同批次的销量演化。MySQL 8 不支持 DROP INDEX IF EXISTS，单独执行。
ALTER TABLE brs_ranking_raw DROP INDEX uk_asin_month;

-- 3. 追加 BRS 榜单特有的批次与溯源字段
ALTER TABLE brs_ranking_raw
  ADD COLUMN batch_date    VARCHAR(8)   DEFAULT NULL COMMENT '采集/请求周批次，格式 YYYYMMDD（仿 deng_zong_shop）',
  ADD COLUMN batch_label   VARCHAR(100) DEFAULT '' COMMENT '批次名称，如 UK-kitchen-30页',
  ADD COLUMN source_run_id VARCHAR(40)  DEFAULT NULL COMMENT '溯源：卖家精灵请求中心 REQ 任务 runId',
  -- 同一批次内同一 (站点, ASIN) 只保留一条；含 marketplace 支持三国进同一批次（同 ASIN 跨站不冲突）
  ADD UNIQUE KEY uk_mp_asin_batch (marketplace, asin, batch_date),
  ADD KEY idx_batch_date (batch_date),
  ADD KEY idx_batch_label (batch_label),
  ADD KEY idx_source_run_id (source_run_id);

-- 4. 说明
-- 数据写入方式：
--   - POST /api/v1/brs-ranking/lookup → 请求中心创建 BRS_ASIN_LOOKUP 任务 → 串行消费
--     → BrsRankingService.doLookupAndSave 映射卖家精灵 JSON → INSERT ... ON DUPLICATE KEY UPDATE
-- 查询方式（复用选品框架，与竞品/新品榜完全一致的列口径）：
--   - POST /api/v1/brs-ranking/products → 分页筛选（价格/BSR/销量/周批次…）

