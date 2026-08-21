-- 检查product_type字段的值
SELECT DISTINCT product_type, COUNT(*) as count 
FROM selection_products 
GROUP BY product_type;

-- 检查同时满足 country='英国' 和 product_type='new' 的记录
SELECT COUNT(*) as count 
FROM selection_products 
WHERE country = '英国' 
AND product_type = 'new';

-- 检查同时满足所有条件的记录
SELECT COUNT(*) as count 
FROM selection_products 
WHERE country = '英国' 
AND source LIKE '%新品榜%'
AND product_type = 'new';

-- 查看几条英国的数据的完整信息
SELECT id, asin, product_title, country, source, product_type, data_filter_mode
FROM selection_products 
WHERE country = '英国' 
LIMIT 5;
