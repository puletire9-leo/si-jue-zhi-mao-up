-- 2026-06-22: 扩展 title 列长度 500 → 1000
-- 原因: 德国 ASIN 导入失败，德语商品标题（含兼容车型描述+多语言）经常超过 500 字符
-- 影响表: asin_import_results, deng_zong_shop, product_30day_new, file_links

ALTER TABLE asin_import_results MODIFY COLUMN title VARCHAR(1000);
ALTER TABLE deng_zong_shop MODIFY COLUMN title VARCHAR(1000);
ALTER TABLE product_30day_new MODIFY COLUMN title VARCHAR(1000);
ALTER TABLE file_links MODIFY COLUMN title VARCHAR(1000);

-- 同时为 deng_zong_shop 添加 batch_date 列（品线选品500修复）
ALTER TABLE deng_zong_shop ADD COLUMN IF NOT EXISTS batch_date VARCHAR(10) DEFAULT NULL AFTER source;
