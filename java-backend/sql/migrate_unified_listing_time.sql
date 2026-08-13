-- 统一表上架时间字段迁移：合并 5 列为 listing_time + listing_time_source
-- 2026-08-11

-- Step 1: 加新列
ALTER TABLE lingxing_product_unified
  ADD COLUMN listing_time VARCHAR(7) DEFAULT NULL COMMENT '上架月份 YYYY-MM' AFTER product_create_time,
  ADD COLUMN listing_time_source VARCHAR(64) DEFAULT NULL COMMENT '上架时间依据' AFTER listing_time;

-- Step 2: 迁移旧数据（三级兜底同优先级）
UPDATE lingxing_product_unified
SET listing_time = COALESCE(fba_first_available_month,
                             DATE_FORMAT(listing_open_date, '%Y-%m'),
                             model_start_month),
    listing_time_source = CASE
        WHEN fba_first_available_month IS NOT NULL THEN '周表FBA可售首现'
        WHEN listing_open_date IS NOT NULL THEN 'listing真实上架日'
        WHEN model_start_month IS NOT NULL THEN '商品创建时间兜底'
        ELSE NULL END;

-- Step 3: 删旧列
ALTER TABLE lingxing_product_unified
  DROP COLUMN fba_first_available_month,
  DROP COLUMN fba_first_available_basis,
  DROP COLUMN listing_open_date,
  DROP COLUMN model_start_month,
  DROP COLUMN model_start_basis;

-- Step 4: 索引用 idx_listing_time 替代 idx_model_start
ALTER TABLE lingxing_product_unified DROP INDEX idx_model_start;
ALTER TABLE lingxing_product_unified ADD INDEX idx_listing_time (listing_time);
