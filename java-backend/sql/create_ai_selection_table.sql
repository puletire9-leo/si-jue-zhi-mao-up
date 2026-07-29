-- ============================================================
-- AI 选品表（ai_selection）
-- 说明：AI Agent 投递 / 手动导入的 ASIN 数据。
--       表结构镜像 competitor_products_clean，额外增加批次追溯列。
-- ============================================================

-- 1. 从 competitor_products_clean 克隆结构（含所有业务列）
CREATE TABLE IF NOT EXISTS ai_selection LIKE competitor_products_clean;

-- 2. 剥离 clean 表专用的清洗列与唯一键。
--    competitor_products_clean 带 uk_batch_dedup(marketplace, effective_week_tag, dedup_key)
--    以及 NOT NULL 的 dedup_key / effective_week_tag。ai_selection 走 batch 投递语义，
--    这些列既不填也不该沿用——不清掉的话：
--      · 严格模式：INSERT 因 dedup_key 无默认值而报错；
--      · 非严格模式：全为 '' 撞 uk_batch_dedup，INSERT IGNORE 只留一条、其余静默丢失。
ALTER TABLE ai_selection DROP INDEX uk_batch_dedup;
ALTER TABLE ai_selection
  DROP COLUMN dedup_key,
  DROP COLUMN effective_week_tag,
  DROP COLUMN cleaned_at;

-- 3. 追加 AI 选品特有的批次与溯源字段
ALTER TABLE ai_selection
  ADD COLUMN batch_id     VARCHAR(64)  NOT NULL COMMENT '投递/导入批次 UUID（格式：batch_<uuid>）',
  ADD COLUMN batch_label  VARCHAR(255) DEFAULT '' COMMENT '批次名称，由调用方传入',
  ADD COLUMN source_ref   VARCHAR(32)  DEFAULT '' COMMENT '来源表：shop_products / competitor_products_clean',
  ADD COLUMN pushed_by    VARCHAR(32)  DEFAULT '' COMMENT '投递人用户 ID',
  ADD COLUMN pushed_at    DATETIME     DEFAULT CURRENT_TIMESTAMP COMMENT '投递时间',
  -- 同一批次内同一 (ASIN, 站点) 只保留一条；含 marketplace 以支持三国合并进一个批次
  -- （同 ASIN 跨站点不冲突）。见 alter_ai_selection_uk_marketplace.sql。
  ADD UNIQUE KEY uk_batch_asin_mp (batch_id, asin, marketplace),
  ADD KEY idx_carrier_mp_asin (carrier, marketplace, asin),
  ADD KEY idx_batch_label (batch_label),
  ADD KEY idx_pushed_by (pushed_by),
  ADD KEY idx_pushed_at (pushed_at),
  ADD KEY idx_batch_id_pushed_at (batch_id, pushed_at);

-- 3. 说明
-- 数据写入方式：
--   - AI Agent 调 POST /api/v1/ai-selection-pool/push → 查 shop_products / competitor_products_clean → INSERT
--   - 用户手动导入调 POST /api/v1/ai-selection-pool/import → 同上
-- 查询方式（复用选品框架）：
--   - POST /api/v1/ai-selection-pool/products → 分页筛选
--   - GET  /api/v1/ai-selection-pool/batches → 批次列表（RangeFilterPanel 用）
