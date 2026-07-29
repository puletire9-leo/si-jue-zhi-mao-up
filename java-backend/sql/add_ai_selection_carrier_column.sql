-- ============================================================
-- ai_selection 增加 carrier 列（非标载体键）
-- 说明：标记该批次/该行属于哪个非标载体（对应 nonstandard_carrier.carrier_key）。
--       全量捞取（/harvest）按载体写入；手动导入（/import）可选带 carrier。
--
-- ⚠️ ALTER ADD COLUMN 不幂等，执行前先查 information_schema 确认 carrier 列不存在：
--   SELECT COLUMN_NAME FROM information_schema.columns
--   WHERE table_schema=DATABASE() AND table_name='ai_selection' AND COLUMN_NAME='carrier';
-- ============================================================

ALTER TABLE ai_selection
  ADD COLUMN carrier VARCHAR(64) DEFAULT '' COMMENT '非标载体键（对应 nonstandard_carrier.carrier_key）' AFTER source_ref,
  ADD KEY idx_carrier (carrier);

-- 可选：把已有的挂牌测试批次标记为 guapai
-- UPDATE ai_selection SET carrier='guapai' WHERE batch_label LIKE '%挂牌%';
