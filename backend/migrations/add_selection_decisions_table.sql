-- ============================================================
-- 决策反馈闭环 - 选品决策记录表
-- 文档：docs/选品算法/14-决策反馈闭环.md
-- 用途：记录每个S1/S2级ASIN的选品决策快照，3个月后验证预测准确性
-- ============================================================

CREATE TABLE IF NOT EXISTS selection_decisions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    
    -- 产品标识
    marketplace VARCHAR(10) NOT NULL COMMENT '站点 UK/DE/US',
    asin VARCHAR(20) NOT NULL COMMENT '被评估的ASIN',
    decision_month VARCHAR(7) NOT NULL COMMENT '决策月份 如 2026-01',
    
    -- 品类信息
    category_label VARCHAR(200) COMMENT '第2级品类名',
    category_prototype VARCHAR(20) COMMENT '品类原型 DA/FH/FP/TN/PE/PS/BASIC',
    
    -- 评分快照（决策时刻的8维分数）
    selection_score INT COMMENT '选品总分 0-100',
    selection_grade VARCHAR(2) COMMENT '选品等级 S1/S2',
    sel_size_score TINYINT COMMENT '轻小件指数',
    sel_volume_score TINYINT COMMENT '体积成本指数',
    sel_profit_score TINYINT COMMENT '利润指数',
    sel_emotion_score TINYINT COMMENT '情绪价值指数',
    sel_decor_score TINYINT COMMENT '装饰价值指数',
    sel_fission_score TINYINT COMMENT '裂变能力指数',
    sel_culture_score TINYINT COMMENT '文化匹配度',
    sel_market_score TINYINT COMMENT '市场容量指数',
    
    -- 决策快照
    decision_score DECIMAL(3,1) COMMENT '5维决策评分 0-10',
    decision_status VARCHAR(20) COMMENT 'LAUNCH/CONDITIONAL/WATCH',
    signal_boosts JSON COMMENT '信号加成 {"explosion":"🔴","arbitrage":72}',
    
    -- 决策时基线数据（3个月后对比用）
    baseline_bsr INT COMMENT '决策时BSR',
    baseline_units INT COMMENT '决策时月销量',
    baseline_price DECIMAL(8,2) COMMENT '决策时售价',
    baseline_ratings INT COMMENT '决策时评论数',
    
    -- 验证结果（3个月后填充）
    verify_month VARCHAR(7) COMMENT '验证月份 如 2026-04',
    verify_bsr INT COMMENT '验证时BSR',
    verify_units INT COMMENT '验证时月销量',
    verify_price DECIMAL(8,2) COMMENT '验证时售价',
    verify_ratings INT COMMENT '验证时评论数',
    
    -- 验证判定
    outcome VARCHAR(20) COMMENT 'CONFIRMED/EXCEEDED/STABLE/DISAPPOINTED/DATA_MISSING',
    outcome_detail TEXT COMMENT '判定细节说明',
    
    -- 元数据
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    verified_at DATETIME COMMENT '验证执行时间',
    verified_by VARCHAR(50) COMMENT 'auto 或审核人',
    
    UNIQUE KEY uk_decision (marketplace, asin, decision_month),
    INDEX idx_grade (selection_grade),
    INDEX idx_outcome (outcome),
    INDEX idx_verify_month (verify_month),
    INDEX idx_decision_month (decision_month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='选品决策记录表 - 反馈闭环核心';

-- ============================================================
-- 权重配置表（如不存在则创建）
-- 用于存储校准后的品类专属权重
-- ============================================================

INSERT INTO api_config (config_key, config_value, config_type, description)
VALUES (
    'selection_weights_basic',
    '{"size":15,"volume":15,"profit":20,"emotion":15,"decor":10,"fission":10,"culture":5,"market":10}',
    'JSON',
    '选品8维基础权重（邓总原始）'
)
ON DUPLICATE KEY UPDATE config_key = config_key;
