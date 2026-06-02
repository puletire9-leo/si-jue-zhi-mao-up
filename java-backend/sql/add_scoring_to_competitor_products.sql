-- 为 competitor_products 表添加评分配置字段
ALTER TABLE competitor_products
    ADD COLUMN score INT DEFAULT NULL COMMENT '综合评分(0-100)',
    ADD COLUMN grade VARCHAR(2) DEFAULT NULL COMMENT '等级(S/A/B/C/D)',
    ADD COLUMN week_tag VARCHAR(10) DEFAULT NULL COMMENT 'ISO周标记(2026-W19)',
    ADD COLUMN is_current INT DEFAULT 0 COMMENT '是否本周数据(1=是, 0=否)';
