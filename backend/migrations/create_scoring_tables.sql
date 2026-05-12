-- 选品评分系统：创建评分配置表和等级阈值表
-- 执行时间：2026-05-06

-- 评分维度配置表
CREATE TABLE IF NOT EXISTS scoring_config (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '配置ID',
    dimension_key VARCHAR(50) NOT NULL UNIQUE COMMENT '维度标识',
    display_name VARCHAR(100) NOT NULL COMMENT '显示名称',
    weight DECIMAL(5,2) NOT NULL COMMENT '权重百分比',
    thresholds JSON NOT NULL COMMENT '阈值配置',
    is_active TINYINT(1) DEFAULT 1 COMMENT '是否启用',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='评分维度配置表';

-- 等级阈值配置表
CREATE TABLE IF NOT EXISTS grade_thresholds (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '配置ID',
    grade VARCHAR(2) NOT NULL UNIQUE COMMENT '等级（S/A/B/C/D）',
    min_score INT NOT NULL COMMENT '最低分',
    max_score INT NOT NULL COMMENT '最高分',
    color VARCHAR(20) DEFAULT NULL COMMENT '前端显示颜色',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='等级阈值配置表';

-- 插入默认评分维度配置
INSERT INTO scoring_config (dimension_key, display_name, weight, thresholds) VALUES
('listing_age', '上架时间', 30.00, '[{"max":30,"score":100},{"max":60,"score":80},{"max":90,"score":60},{"max":120,"score":40},{"max":180,"score":20},{"max":9999,"score":0}]'),
('sales_volume', '销量', 33.00, '[{"min":0,"max":5,"score":20},{"min":5,"max":10,"score":20},{"min":10,"max":20,"score":35},{"min":20,"max":35,"score":50},{"min":35,"max":50,"score":75},{"min":50,"max":100,"score":100},{"min":100,"max":150,"score":75},{"min":150,"max":200,"score":55},{"min":200,"max":250,"score":35},{"min":250,"max":300,"score":20},{"min":300,"max":99999,"score":20}]'),
('bsr_rank', '大类BSR', 25.00, '[{"max":10000,"score":100},{"max":30000,"score":70},{"max":50000,"score":50},{"max":100000,"score":35},{"max":99999999,"score":20}]'),
('price', '价格竞争力', 12.00, '[{"min":0,"max":4.99,"score":20},{"min":4.99,"max":6,"score":60},{"min":6,"max":7,"score":75},{"min":7,"max":8.99,"score":88},{"min":8.99,"max":10,"score":100},{"min":10,"max":12,"score":90},{"min":12,"max":15,"score":75},{"min":15,"max":18,"score":55},{"min":18,"max":20,"score":40},{"min":20,"max":99999,"score":20}]')
ON DUPLICATE KEY UPDATE display_name=VALUES(display_name);

-- 插入默认等级阈值
INSERT INTO grade_thresholds (grade, min_score, max_score, color) VALUES
('S', 90, 100, '#67C23A'),
('A', 80, 89, '#409EFF'),
('B', 65, 79, '#E6A23C'),
('C', 50, 64, '#909399'),
('D', 0, 49, '#F56C6C')
ON DUPLICATE KEY UPDATE min_score=VALUES(min_score), max_score=VALUES(max_score), color=VALUES(color);
