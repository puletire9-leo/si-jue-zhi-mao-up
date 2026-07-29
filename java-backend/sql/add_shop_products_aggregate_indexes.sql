-- 店铺选品页「分类聚合 / 批次聚合」性能优化索引。
--
-- 背景（三个后台深审 + ShopProductMapper.java 复核，shop_products UK 16.6~77 万行）：
--   selectionCategories：SELECT TRIM(node_label_path), COUNT(1) ... GROUP BY TRIM(node_label_path)
--     —— TRIM() 函数谓词使普通 (node_label_path) 索引失效，每次进页面/切筛选都全表聚合。
--   selectionBatches   ：SELECT ... COUNT(1) ... WHERE marketplace=? AND batch_date REGEXP ...
--     GROUP BY batch_date —— 现有 idx_shop_products_seller 是 (marketplace, seller_name, batch_date)，
--     GROUP BY 跳过 seller_name 中间列无法走松散索引扫描，退化为全分区扫描 + 临时表。
--
-- 两个索引配合 Service 层 categoryCache（60~90min TTL）：缓存挡住绝大多数重复请求，
-- 缓存穿透（导入后失效、TTL 过期）时索引把单次全表聚合从秒级降到走索引。
--
-- 普通联合索引用 ALGORITHM=INPLACE, LOCK=NONE 在线添加；MySQL 的函数索引内部会新增
-- 隐藏虚拟列，不支持 LOCK=NONE，因此函数索引使用 LOCK=SHARED。执行函数索引期间会阻塞写入，
-- 生产应先暂停访问 shop_products 的应用服务。information_schema 守卫保证重复执行安全。
-- 要求 MySQL 8.0.13+（函数索引 functional index）。生产库 MySQL 8.0 已满足。
SET @schema_name = DATABASE();

-- 1. 分类聚合函数索引：直接对 TRIM(node_label_path) 建索引，命中 GROUP BY TRIM(node_label_path)。
--    不改查询 SQL、不改列定义、不动写入端，是对现有 TRIM 写法零侵入的加速方案。
--    函数索引名不能与列名冲突，用独立命名 idx_shop_sel_cat_trim。
SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.statistics
       WHERE table_schema=@schema_name AND table_name='shop_products'
         AND index_name='idx_shop_sel_cat_trim') = 0,
    'ALTER TABLE shop_products ADD INDEX idx_shop_sel_cat_trim ((TRIM(node_label_path))), ALGORITHM=INPLACE, LOCK=SHARED',
    'SELECT ''shop_products.idx_shop_sel_cat_trim exists''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. 批次聚合索引：(marketplace, batch_date) 让 WHERE marketplace=? + GROUP BY batch_date
--    走松散索引扫描（loose index scan），无需回表、无需临时表排序。
--    REGEXP 过滤保留（只剔除格式脏数据，规范数据下命中行占绝大多数，不影响索引使用）。
SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.statistics
       WHERE table_schema=@schema_name AND table_name='shop_products'
         AND index_name='idx_shop_sel_batch') = 0,
    'ALTER TABLE shop_products ADD INDEX idx_shop_sel_batch (marketplace, batch_date), ALGORITHM=INPLACE, LOCK=NONE',
    'SELECT ''shop_products.idx_shop_sel_batch exists''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
