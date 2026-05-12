-- 查看country='英国'的记录的source值
SELECT 
    source, 
    COUNT(*) as count 
FROM selection_products 
WHERE country = '英国' 
GROUP BY source;

-- 查看country='英国'的记录的product_type值
SELECT 
    product_type, 
    COUNT(*) as count 
FROM selection_products 
WHERE country = '英国' 
GROUP BY product_type;

-- 如果想查看具体数据
SELECT id, asin, country, source, product_type, data_filter_mode
FROM selection_products 
WHERE country = '英国' 
LIMIT 5;
