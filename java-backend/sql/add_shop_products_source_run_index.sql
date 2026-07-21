-- 店铺选品：商品墙/快照类查询按 source_run_id 过滤，此前无对应索引。
-- productWall / compare / insight 等接口 WHERE = (marketplace, seller_name, source_run_id)，
-- 现有 idx_shop_products_seller 是 (marketplace, seller_name, batch_date)，命中不了 source_run_id。
-- 重复执行安全。
SET @schema_name = DATABASE();

SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.statistics
       WHERE table_schema=@schema_name AND table_name='shop_products'
         AND index_name='idx_shop_products_source_run') = 0,
    'ALTER TABLE shop_products ADD INDEX idx_shop_products_source_run (marketplace, seller_name, source_run_id), ALGORITHM=INPLACE, LOCK=NONE',
    'SELECT ''shop_products.idx_shop_products_source_run exists''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
