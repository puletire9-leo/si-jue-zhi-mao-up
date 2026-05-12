-- 选品评分系统：为 selection_products 新增评分相关字段
-- 执行时间：2026-05-06

-- 新增评分字段
ALTER TABLE selection_products
ADD COLUMN score INT DEFAULT NULL COMMENT '评分（0-100）' AFTER delivery_method,
ADD COLUMN grade VARCHAR(2) DEFAULT NULL COMMENT '等级（S/A/B/C/D）' AFTER score,
ADD COLUMN week_tag VARCHAR(10) DEFAULT NULL COMMENT '周标记（如2026-W19）' AFTER grade,
ADD COLUMN is_current TINYINT(1) DEFAULT 0 COMMENT '是否本周数据（1=本周, 0=往期）' AFTER week_tag;

-- 新增索引
CREATE INDEX idx_score ON selection_products(score);
CREATE INDEX idx_grade ON selection_products(grade);
CREATE INDEX idx_week_tag ON selection_products(week_tag);
CREATE INDEX idx_is_current ON selection_products(is_current);
