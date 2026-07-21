-- 店铺选品页（AllSelection reference 场景 → selectionProducts）性能优化索引。
--
-- 根因（生产库 EXPLAIN + profiling 实测，shop_products UK 16.6 万行）：
--   1. 首屏默认查询 ORDER BY updated_at DESC 对全分区 filesort → 2711ms。
--   2. 带筛选查询（price/units/listing_days 范围）无复合索引，
--      只能用 marketplace(基数=2) 前缀扫全分区，命中率 0.07% + filesort → 494ms。
--
-- 实测效果：
--   idx_shop_sel_default  : 默认查询 2711ms → 2.2ms（Backward index scan，无 filesort）。
--   idx_shop_sel_metrics  : 带筛选查询 494ms → 105ms。
--
-- 两个索引均用 ALGORITHM=INPLACE, LOCK=NONE 在线添加，重复执行安全。
SET @schema_name = DATABASE();

-- 默认排序索引：selectionProducts 默认 ORDER BY updated_at DESC。
-- (marketplace, updated_at) 让优化器反向扫描直接拿有序结果 + LIMIT 提前终止，消除全量 filesort。
SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.statistics
       WHERE table_schema=@schema_name AND table_name='shop_products'
         AND index_name='idx_shop_sel_default') = 0,
    'ALTER TABLE shop_products ADD INDEX idx_shop_sel_default (marketplace, updated_at), ALGORITHM=INPLACE, LOCK=NONE',
    'SELECT ''shop_products.idx_shop_sel_default exists''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 商品级筛选 + 销量排序索引：覆盖高频的 units/price/listing_days 范围过滤与 units 排序。
-- units 放第 2 列既支持 units 范围过滤，又支持 ORDER BY units 的有序读取。
SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.statistics
       WHERE table_schema=@schema_name AND table_name='shop_products'
         AND index_name='idx_shop_sel_metrics') = 0,
    'ALTER TABLE shop_products ADD INDEX idx_shop_sel_metrics (marketplace, units, price, listing_days), ALGORITHM=INPLACE, LOCK=NONE',
    'SELECT ''shop_products.idx_shop_sel_metrics exists''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
