-- 2026-06-25: 扩展 asin_import_tasks.import_type 列长度 20 → 50
-- 原因: 卖家名批量导入功能使用 SELLER_COMPETITOR_PRODUCTS / SELLER_DENG_ZONG_SHOP 等长字符串作为类型
--       原 VARCHAR(20) 装不下，导致 sellerPreview/sellerExecute 接口 500 错误

ALTER TABLE asin_import_tasks MODIFY COLUMN import_type VARCHAR(50) DEFAULT 'ASIN';
