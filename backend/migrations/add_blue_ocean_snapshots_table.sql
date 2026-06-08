-- ============================================================
-- 蓝海快照表
-- 文档：docs/选品算法/16-蓝海雷达.md
-- 用途：记录品类的蓝海分析快照，追踪蓝海机会变化
-- ============================================================

CREATE TABLE IF NOT EXISTS blue_ocean_snapshots (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    
    -- 品类标识
    marketplace VARCHAR(10) NOT NULL COMMENT '站点 UK/DE/US',
    category_label VARCHAR(200) NOT NULL COMMENT '品类名称',
    snapshot_month VARCHAR(7) NOT NULL COMMENT '快照月份 如 2026-06',
    
    -- 蓝海分析结果
    overall_score INT COMMENT '综合蓝海分 0-100',
    classification VARCHAR(20) COMMENT 'BLUE_OCEAN/LIGHT_BLUE/PURPLE_OCEAN/RED_OCEAN',
    
    -- 4个信号维度
    price_gap_score INT COMMENT '价格带空白信号 0-100',
    price_gap_status VARCHAR(20) COMMENT 'STRONG/MODERATE/WEAK/ABSENT',
    
    competition_gap_score INT COMMENT '竞争分散信号 0-100',
    competition_gap_status VARCHAR(20) COMMENT 'STRONG/MODERATE/WEAK/ABSENT',
    
    barrier_score INT COMMENT '评论壁垒信号 0-100',
    barrier_status VARCHAR(20) COMMENT 'STRONG/MODERATE/WEAK/ABSENT',
    
    homogeneity_score INT COMMENT '产品同质化信号 0-100',
    homogeneity_status VARCHAR(20) COMMENT 'STRONG/MODERATE/WEAK/ABSENT',
    
    -- 市场指标快照
    cr3 DECIMAL(5,4) COMMENT 'CR3竞争集中度',
    entry_barrier VARCHAR(20) COMMENT '进入壁垒',
    units_growth_rate DECIMAL(8,2) COMMENT '销量增速',
    avg_ratings DECIMAL(8,2) COMMENT '平均评论数',
    avg_price DECIMAL(8,2) COMMENT '均价',
    price_range DECIMAL(8,2) COMMENT '价格幅度',
    product_count INT COMMENT '产品数量',
    
    -- 推荐建议
    recommendations JSON COMMENT '推荐建议列表',
    confidence DECIMAL(3,2) COMMENT '置信度',
    
    -- 元数据
    computed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- 唯一约束
    UNIQUE KEY uk_snapshot (marketplace, category_label, snapshot_month),
    INDEX idx_classification (classification),
    INDEX idx_snapshot_month (snapshot_month),
    INDEX idx_marketplace (marketplace)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='蓝海快照表 - 追踪蓝海机会变化';
