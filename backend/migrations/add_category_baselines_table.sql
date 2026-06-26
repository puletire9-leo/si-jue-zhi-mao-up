-- ============================================================
-- 动态品类基线表
-- 文档：docs/选品算法/15-动态品类基线.md
-- 用途：存储品类维度的百分位基线数据，用于相对评分
-- ============================================================

CREATE TABLE IF NOT EXISTS category_baselines (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    
    -- 品类标识
    marketplace VARCHAR(10) NOT NULL COMMENT '站点 UK/DE/US',
    category_label VARCHAR(200) NOT NULL COMMENT '品类名称（第2级）',
    archetype VARCHAR(20) COMMENT '品类原型 DA/FH/FP/TN/PE/PS/BASIC',
    
    -- 样本统计
    sample_size INT DEFAULT 0 COMMENT '计算基线的样本产品数',
    baseline_month VARCHAR(7) NOT NULL COMMENT '基线月份 如 2026-06',
    
    -- 8维百分位基线（P25/P50/P75）
    p25_size DECIMAL(12,2) COMMENT '体积友好性 P25 (g)',
    p50_size DECIMAL(12,2) COMMENT '体积友好性 P50 (g)',
    p75_size DECIMAL(12,2) COMMENT '体积友好性 P75 (g)',
    
    p25_volume DECIMAL(12,2) COMMENT '销量/市场容量 P25',
    p50_volume DECIMAL(12,2) COMMENT '销量/市场容量 P50',
    p75_volume DECIMAL(12,2) COMMENT '销量/市场容量 P75',
    
    p25_profit DECIMAL(12,2) COMMENT '利润率 P25',
    p50_profit DECIMAL(12,2) COMMENT '利润率 P50',
    p75_profit DECIMAL(12,2) COMMENT '利润率 P75',
    
    p25_emotion DECIMAL(5,2) COMMENT '情绪价值 P25',
    p50_emotion DECIMAL(5,2) COMMENT '情绪价值 P50',
    p75_emotion DECIMAL(5,2) COMMENT '情绪价值 P75',
    
    p25_decor DECIMAL(5,2) COMMENT '装饰性 P25',
    p50_decor DECIMAL(5,2) COMMENT '装饰性 P50',
    p75_decor DECIMAL(5,2) COMMENT '装饰性 P75',
    
    p25_fission DECIMAL(5,2) COMMENT '裂变潜力 P25',
    p50_fission DECIMAL(5,2) COMMENT '裂变潜力 P50',
    p75_fission DECIMAL(5,2) COMMENT '裂变潜力 P75',
    
    p25_culture DECIMAL(5,2) COMMENT '文化适应性 P25',
    p50_culture DECIMAL(5,2) COMMENT '文化适应性 P50',
    p75_culture DECIMAL(5,2) COMMENT '文化适应性 P75',
    
    p25_market DECIMAL(5,2) COMMENT '市场指标 P25',
    p50_market DECIMAL(5,2) COMMENT '市场指标 P50',
    p75_market DECIMAL(5,2) COMMENT '市场指标 P75',
    
    -- 品类健康度指标
    avg_growth_rate DECIMAL(8,4) COMMENT '品类平均增速',
    avg_cr3 DECIMAL(5,4) COMMENT '品类平均CR3',
    avg_margin DECIMAL(8,4) COMMENT '品类平均利润率',
    avg_rating DECIMAL(3,2) COMMENT '品类平均评分',
    total_products INT COMMENT '品类总产品数',
    
    -- 元数据
    computed_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '计算时间',
    data_source VARCHAR(50) DEFAULT 'auto' COMMENT '数据来源 auto/manual',
    confidence DECIMAL(3,2) DEFAULT 0.80 COMMENT '基线置信度',
    
    -- 唯一约束：同一品类同一月份只有一条基线
    UNIQUE KEY uk_baseline (marketplace, category_label, baseline_month),
    INDEX idx_archetype (archetype),
    INDEX idx_baseline_month (baseline_month),
    INDEX idx_marketplace (marketplace)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='品类百分位基线表 - 动态评分基准';
