-- 检查source字段的值
SELECT DISTINCT source, COUNT(*) as count 
FROM selection_products 
GROUP BY source;

-- 检查同时满足 country='英国' 和 source LIKE '%新品榜%' 的记录
SELECT COUNT(*) as count 
FROM selection_products 
WHERE country = '英国' 
AND source LIKE '%新品榜%';

-- 查看几条英国的数据的source字段
SELECT id, asin, product_title, country, source 
FROM selection_products 
WHERE country = '英国' 
LIMIT 10;
