-- 修复载体库表的 SKU 字段，允许为空并设置默认值
-- 这样可以兼容自动生成SKU的逻辑

-- 修改 carrier_library 表的 sku 字段，允许为空
ALTER TABLE carrier_library 
MODIFY COLUMN sku VARCHAR(255) DEFAULT NULL COMMENT 'SKU编号（系统自动生成）';

-- 如果索引存在则删除
DROP INDEX IF EXISTS idx_sku ON carrier_library;

-- 重新创建索引（允许NULL值）
CREATE INDEX idx_sku ON carrier_library(sku);

-- 修改 carrier_library_recycle_bin 表的 sku 字段，允许为空
ALTER TABLE carrier_library_recycle_bin 
MODIFY COLUMN sku VARCHAR(255) DEFAULT NULL COMMENT 'SKU编号（系统自动生成）';

-- 如果索引存在则删除
DROP INDEX IF EXISTS idx_sku ON carrier_library_recycle_bin;

-- 重新创建索引（允许NULL值）
CREATE INDEX idx_sku ON carrier_library_recycle_bin(sku);
