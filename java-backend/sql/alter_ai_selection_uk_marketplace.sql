-- ============================================================
-- ai_selection 唯一键改造：支持三国合并进「一个批次」+ 增量去重加速
--
-- 背景：原唯一键 uk_batch_asin (batch_id, asin) 不含 marketplace，
--       三国合批时同一 ASIN 跨站点(US/UK)会被 INSERT IGNORE 丢掉第二条。
--       故扩为 (batch_id, asin, marketplace)。新键是旧键超集，现有数据无冲突行，ALTER 安全。
--
-- 另加 idx_carrier_mp_asin (carrier, marketplace, asin)：
--       服务端增量捞取的 NOT EXISTS(载体+站点+ASIN 历史) 走此索引。
--
-- ⚠️ ALTER 不幂等。执行前确认旧键存在、新键不存在：
--   SHOW INDEX FROM ai_selection WHERE Key_name IN ('uk_batch_asin','uk_batch_asin_mp','idx_carrier_mp_asin');
-- ⚠️ 执行前先备份 ai_selection（见部署流程）。
-- ============================================================

ALTER TABLE ai_selection
  DROP KEY uk_batch_asin,
  ADD UNIQUE KEY uk_batch_asin_mp (batch_id, asin, marketplace);

ALTER TABLE ai_selection
  ADD KEY idx_carrier_mp_asin (carrier, marketplace, asin);
