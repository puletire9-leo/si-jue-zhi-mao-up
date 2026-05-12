-- 选品回收站表添加国家和数据筛选模式字段
-- 创建时间: 2026-03-24
-- 作者: AI Assistant

-- 检查字段是否存在，如果不存在则添加
SET @dbname = DATABASE();
SET @tablename = 'selection_recycle_bin';

-- 添加 country 字段
SET @columnname = 'country';
SET @sql = CONCAT(
    'ALTER TABLE ', @tablename,
    ' ADD COLUMN ', @columnname, ' VARCHAR(50) NULL COMMENT "国家（英国/德国）"'
);

SET @column_exists = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = @dbname
    AND table_name = @tablename
    AND column_name = @columnname
);

SET @sql = IF(@column_exists = 0, @sql, 'SELECT "country 字段已存在，跳过添加"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加 data_filter_mode 字段
SET @columnname = 'data_filter_mode';
SET @sql = CONCAT(
    'ALTER TABLE ', @tablename,
    ' ADD COLUMN ', @columnname, ' VARCHAR(50) NULL COMMENT "数据筛选模式（模式一/模式二）"'
);

SET @column_exists = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = @dbname
    AND table_name = @tablename
    AND column_name = @columnname
);

SET @sql = IF(@column_exists = 0, @sql, 'SELECT "data_filter_mode 字段已存在，跳过添加"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加索引以提高查询性能
SET @indexname = 'idx_recycle_country';
SET @sql = CONCAT('CREATE INDEX ', @indexname, ' ON ', @tablename, ' (country)');
SET @index_exists = (
    SELECT COUNT(*)
    FROM information_schema.statistics
    WHERE table_schema = @dbname
    AND table_name = @tablename
    AND index_name = @indexname
);
SET @sql = IF(@index_exists = 0, @sql, 'SELECT "idx_recycle_country 索引已存在，跳过创建"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @indexname = 'idx_recycle_data_filter_mode';
SET @sql = CONCAT('CREATE INDEX ', @indexname, ' ON ', @tablename, ' (data_filter_mode)');
SET @index_exists = (
    SELECT COUNT(*)
    FROM information_schema.statistics
    WHERE table_schema = @dbname
    AND table_name = @tablename
    AND index_name = @indexname
);
SET @sql = IF(@index_exists = 0, @sql, 'SELECT "idx_recycle_data_filter_mode 索引已存在，跳过创建"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 更新现有数据，设置默认值
UPDATE selection_recycle_bin 
SET country = '英国', 
    data_filter_mode = '模式一' 
WHERE country IS NULL OR country = '';

SELECT '回收站表迁移完成：已成功添加 country 和 data_filter_mode 字段' AS message;
