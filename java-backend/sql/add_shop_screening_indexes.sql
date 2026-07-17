-- 统一店铺筛选工作台索引，重复执行安全。
SET @schema_name = DATABASE();

SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.statistics
       WHERE table_schema=@schema_name AND table_name='shop_products' AND index_name='idx_shop_products_screening') = 0,
    'CREATE INDEX idx_shop_products_screening ON shop_products (marketplace, batch_code, seller_name, asin)',
    'SELECT ''shop_products.idx_shop_products_screening exists''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.statistics
       WHERE table_schema=@schema_name AND table_name='shop_products' AND index_name='idx_shop_products_screening_metrics') = 0,
    'CREATE INDEX idx_shop_products_screening_metrics ON shop_products (marketplace, batch_code, listing_days, units)',
    'SELECT ''shop_products.idx_shop_products_screening_metrics exists''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.statistics
       WHERE table_schema=@schema_name AND table_name='shop_watchlist' AND index_name='idx_shop_watchlist_screening') = 0,
    'CREATE INDEX idx_shop_watchlist_screening ON shop_watchlist (marketplace, seller_name, status, source_type, updated_at, id)',
    'SELECT ''shop_watchlist.idx_shop_watchlist_screening exists''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
