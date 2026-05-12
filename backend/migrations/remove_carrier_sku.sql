-- 移除载体库表中的 SKU 字段
ALTER TABLE carrier_library DROP COLUMN sku;
ALTER TABLE carrier_library DROP INDEX idx_sku;

-- 移除载体库回收站表中的 SKU 字段
ALTER TABLE carrier_library_recycle_bin DROP COLUMN sku;
ALTER TABLE carrier_library_recycle_bin DROP INDEX idx_sku;
