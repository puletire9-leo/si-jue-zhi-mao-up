-- 定稿表添加侵权标注字段迁移脚本
-- 创建时间: 2026-03-20
-- 功能: 在 final_drafts 表中添加 infringement_label 字段用于存储侵权标注信息

-- ============================================
-- 请在 MySQL 客户端中手动执行以下语句
-- ============================================

-- 1. 添加 infringement_label 字段到 final_drafts 表
ALTER TABLE `final_drafts`
ADD COLUMN `infringement_label` VARCHAR(500) DEFAULT NULL COMMENT '侵权标注';

-- 2. 添加 infringement_label 字段到 final_draft_recycle_bin 表（回收站表也需要该字段）
ALTER TABLE `final_draft_recycle_bin`
ADD COLUMN `infringement_label` VARCHAR(500) DEFAULT NULL COMMENT '侵权标注';

-- ============================================
-- 验证字段是否添加成功的查询语句（可选）
-- ============================================
-- SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_COMMENT
-- FROM INFORMATION_SCHEMA.COLUMNS
-- WHERE TABLE_NAME = 'final_drafts' AND COLUMN_NAME = 'infringement_label';
