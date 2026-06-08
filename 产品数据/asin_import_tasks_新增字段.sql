ALTER TABLE asin_import_tasks 
    ADD COLUMN import_type VARCHAR(20) DEFAULT 'ASIN' COMMENT '导入类型: ASIN 或 SELLER' 
    AFTER marketplace;
