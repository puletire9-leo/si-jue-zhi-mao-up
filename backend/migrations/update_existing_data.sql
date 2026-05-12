-- 更新现有选品数据
-- 将所有记录的国家设置为英国，数据筛选模式设置为模式一
-- 创建时间: 2026-03-24
-- 作者: AI Assistant

-- 先检查字段是否存在
SET @dbname = DATABASE();
SET @tablename = 'selection_products';

-- 检查 country 字段是否存在
SET @country_exists = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = @dbname
    AND table_name = @tablename
    AND column_name = 'country'
);

-- 检查 data_filter_mode 字段是否存在
SET @data_filter_mode_exists = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = @dbname
    AND table_name = @tablename
    AND column_name = 'data_filter_mode'
);

-- 如果字段存在，则更新数据
SET @update_sql = IF(
    @country_exists > 0 AND @data_filter_mode_exists > 0,
    'UPDATE selection_products SET country = "英国", data_filter_mode = "模式一" WHERE country IS NULL OR country = ""',
    'SELECT "字段不存在，跳过更新" AS message'
);

PREPARE stmt FROM @update_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 显示更新结果
SELECT 
    COUNT(*) AS total_records,
    SUM(CASE WHEN country = '英国' THEN 1 ELSE 0 END) AS uk_records,
    SUM(CASE WHEN data_filter_mode = '模式一' THEN 1 ELSE 0 END) AS mode1_records
FROM selection_products;
