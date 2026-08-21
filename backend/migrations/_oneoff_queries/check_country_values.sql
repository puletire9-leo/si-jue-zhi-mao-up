-- 检查 country 字段的值及其长度
SELECT 
    country,
    LENGTH(country) as length,
    HEX(country) as hex_value,
    COUNT(*) as count
FROM selection_products
WHERE country IS NOT NULL
GROUP BY country
ORDER BY count DESC;

-- 检查 country='英国' 的记录详情（前5条）
SELECT 
    id,
    asin,
    product_title,
    source,
    country,
    LENGTH(country) as country_length,
    HEX(country) as country_hex
FROM selection_products
WHERE country = '英国'
LIMIT 5;

-- 检查是否有隐藏字符
SELECT 
    CASE 
        WHEN country = '英国' THEN 'exact_match'
        WHEN country LIKE '%英国%' THEN 'contains_英国'
        WHEN country LIKE '英国%' THEN 'starts_with_英国'
        WHEN country LIKE '%英国' THEN 'ends_with_英国'
        ELSE 'other'
    END as match_type,
    COUNT(*) as count
FROM selection_products
WHERE country IS NOT NULL
GROUP BY match_type;
