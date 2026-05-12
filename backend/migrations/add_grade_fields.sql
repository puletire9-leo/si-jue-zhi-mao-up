-- 选品产品表添加等级相关字段
-- 创建时间: 2026-05-06
-- 说明: 为 selection_products 表添加 grade, score, week_tag, is_current 字段

ALTER TABLE selection_products
ADD COLUMN IF NOT EXISTS grade VARCHAR(10) NULL COMMENT '等级（S/A/B/C/D）',
ADD COLUMN IF NOT EXISTS score INT NULL COMMENT '评分（0-100）',
ADD COLUMN IF NOT EXISTS week_tag VARCHAR(20) NULL COMMENT '周标记（如2026-W19）',
ADD COLUMN IF NOT EXISTS is_current TINYINT DEFAULT 0 COMMENT '是否本周数据（1=本周, 0=往期）';

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_grade ON selection_products(grade);
CREATE INDEX IF NOT EXISTS idx_score ON selection_products(score);
CREATE INDEX IF NOT EXISTS idx_week_tag ON selection_products(week_tag);
CREATE INDEX IF NOT EXISTS idx_is_current ON selection_products(is_current);

-- 创建组合索引（用于筛选查询）
CREATE INDEX IF NOT EXISTS idx_grade_is_current ON selection_products(grade, is_current);
