-- 检查 country 字段的各种情况
SELECT 
    country,
    LENGTH(country) as length,
    CHAR_LENGTH(country) as char_length,
    HEX(country) as hex_value,
    COUNT(*) as count
FROM selection_products
WHERE country IS NOT NULL AND country != ''
GROUP BY country
ORDER BY count DESC;

-- 检查是否有空格或特殊字符
SELECT 
    CONCAT('"', country, '"') as country_with_quotes,
    LENGTH(country) as length,
    COUNT(*) as count
FROM selection_products
WHERE country LIKE '%英国%'
GROUP BY country;

-- 检查 country 字段为 '英国' 的记录数量
SELECT COUNT(*) as exact_match_count
FROM selection_products
WHERE country = '英国';

-- 检查 country 字段包含 '英国' 的记录数量
SELECT COUNT(*) as contains_count
FROM selection_products
WHERE country LIKE '%英国%';

-- 检查前10条记录的 country 值
SELECT id, asin, country, HEX(country) as hex
FROM selection_products
WHERE country IS NOT NULL
LIMIT 10;
