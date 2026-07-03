-- =================================================================
-- 扩大 asin_import_results.title 字段，避免长标题写入失败
-- 2026-07-01
-- =================================================================

ALTER TABLE `asin_import_results`
    MODIFY COLUMN `title` VARCHAR(1000) DEFAULT NULL COMMENT '产品标题';
