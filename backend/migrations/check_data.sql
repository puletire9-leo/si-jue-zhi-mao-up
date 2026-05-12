-- 检查选品表中的数据
-- 查看country和data_filter_mode字段的数据分布

-- 检查country字段的数据
SELECT 
    'country' as field_name,
    country as field_value,
    COUNT(*) as count
FROM selection_products
WHERE country IS NOT NULL AND country != ''
GROUP BY country
UNION ALL
SELECT 
    'country' as field_name,
    'NULL或空' as field_value,
    COUNT(*) as count
FROM selection_products
WHERE country IS NULL OR country = '';

-- 检查data_filter_mode字段的数据
SELECT 
    'data_filter_mode' as field_name,
    data_filter_mode as field_value,
    COUNT(*) as count
FROM selection_products
WHERE data_filter_mode IS NOT NULL AND data_filter_mode != ''
GROUP BY data_filter_mode
UNION ALL
SELECT 
    'data_filter_mode' as field_name,
    'NULL或空' as field_value,
    COUNT(*) as count
FROM selection_products
WHERE data_filter_mode IS NULL OR data_filter_mode = '';

-- 检查listing_date字段的格式（前10条）
SELECT id, asin, product_title, listing_date, country, data_filter_mode
FROM selection_products
LIMIT 10;

-- 总记录数
SELECT COUNT(*) as total_records FROM selection_products;
