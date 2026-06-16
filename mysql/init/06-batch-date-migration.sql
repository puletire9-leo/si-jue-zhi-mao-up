-- ════════════════════════════════════════════════════
-- 郑总店铺数据按日期分批次存储迁移
-- 为 deng_zong_shop 加 batch_date 列，支持多批次共存
-- ════════════════════════════════════════════════════

ALTER TABLE deng_zong_shop ADD COLUMN batch_date VARCHAR(8) DEFAULT NULL COMMENT '批次日期 YYYYMMDD' AFTER month;
ALTER TABLE deng_zong_shop DROP INDEX uk_asin_month;
ALTER TABLE deng_zong_shop ADD UNIQUE KEY uk_asin_month_batch (asin, month, batch_date);
ALTER TABLE deng_zong_shop ADD INDEX idx_batch_date (batch_date);
