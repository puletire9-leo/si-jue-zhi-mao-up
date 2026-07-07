-- 2026-07-07 导入郑总 clean_no_variants 数据到 deng_zong_shop 时发现：
-- 原唯一索引 uk_asin_month_batch (asin, month, batch_date) 未包含 marketplace，
-- 导致同一个 ASIN 在 UK/DE 同时存在时冲突（欧洲站泛欧商品）。
-- 扩展为 (marketplace, asin, month, batch_date) 以支持跨市场同 ASIN。
-- 执行前请确认没有重复的 (marketplace, asin, month, batch_date) 组合。

ALTER TABLE deng_zong_shop
  DROP INDEX uk_asin_month_batch,
  ADD UNIQUE KEY uk_marketplace_asin_month_batch (marketplace, asin, month, batch_date);
