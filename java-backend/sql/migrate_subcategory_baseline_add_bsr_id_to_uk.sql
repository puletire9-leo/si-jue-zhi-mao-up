-- =================================================================
-- ①线小类基线 · 唯一键收紧到 (marketplace, bsr_id, sub_category, baseline_month)
-- 2026-06-25 · 配合 SubcategoryBaselineMapper.xml 收紧 PARTITION/GROUP BY
-- 适用：dev (sijuelishi_dev) + geji (geji_analysis)
-- =================================================================
-- 背景：
--   旧粒度 (marketplace, sub_category, baseline_month) 会把同名 leaf 在两个 bsr_id 下
--   的样本揉成一行。新粒度按 marketplace × bsr_id × Amazon leaf × month。
-- 安全性：
--   迁移时全量删旧数据再用新口径重算（rebuild from compute-subcategory），
--   避免遗留 bsr_id IS NULL 的旧行造成新唯一键冲突。
-- 步骤：
--   1) 清空 subcategory_baseline（数据是计算产物，可重建）
--   2) bsr_id 改 NOT NULL（与建表 DDL 对齐）
--   3) 旧唯一键 uk_slice 删除
--   4) 新唯一键 uk_slice 创建：marketplace + bsr_id + sub_category + baseline_month
-- 重算：
--   迁移完调 POST /api/v1/category-baseline/compute-subcategory?month=YYYYMM 重灌。
-- =================================================================

-- 1) 清空旧数据（可重算，无业务损失）
TRUNCATE TABLE subcategory_baseline;

-- 2) bsr_id 改为 NOT NULL（旧 schema 是 DEFAULT NULL）
ALTER TABLE subcategory_baseline
    MODIFY COLUMN bsr_id VARCHAR(100) NOT NULL
    COMMENT 'Top-level category slug, partitions the leaf so the same name in two big categories stays separate';

-- 3) 删旧唯一键（如不存在则忽略；MySQL 8 没有 IF EXISTS，需先用 SHOW INDEX 判断）
ALTER TABLE subcategory_baseline DROP INDEX uk_slice;

-- 4) 新唯一键
ALTER TABLE subcategory_baseline
    ADD UNIQUE KEY uk_slice (marketplace, bsr_id, sub_category, baseline_month);

-- 验证：
--   SHOW CREATE TABLE subcategory_baseline\G
--   预期 UNIQUE KEY uk_slice 包含 (marketplace, bsr_id, sub_category, baseline_month)
