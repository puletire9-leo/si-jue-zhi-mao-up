-- 统一表真实上架日期：单一字段 listing_date（DATE）
-- 2026-08-11
-- 策略：
--   老 ASIN（8月前）：保持现有值（FBA首现月补01）
--   新 ASIN（8月后）：优先 listing.open_date > FBA首现 > 创建时间
--   首次写入后锁定，不再变

-- Step 1: 加新列 listing_date
ALTER TABLE lingxing_product_unified
  ADD COLUMN listing_date DATE DEFAULT NULL COMMENT '真实上架日期（首次写入后锁定）'
  AFTER product_create_time;

-- Step 2: 迁移已有数据（VARCHAR(7) '2026-05' → DATE '2026-05-01'）
UPDATE lingxing_product_unified
SET listing_date = STR_TO_DATE(CONCAT(listing_time, '-01'), '%Y-%m-%d')
WHERE listing_time IS NOT NULL AND listing_time != '';

-- Step 3: 删除旧列
ALTER TABLE lingxing_product_unified
  DROP COLUMN listing_time,
  DROP COLUMN listing_time_source;

-- Step 4: 添加索引
ALTER TABLE lingxing_product_unified
  ADD INDEX idx_listing_date (listing_date);
