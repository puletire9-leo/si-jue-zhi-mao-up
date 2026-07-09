-- =================================================================
-- 品线指导记录表
-- 当前 Java 事实来源：ProductLineGuidance entity + ProductLineGuidanceMapper.xml
-- =================================================================

CREATE TABLE IF NOT EXISTS product_line_guidance (
    id BIGINT NOT NULL COMMENT '主键（雪花算法）',
    batch_id VARCHAR(64) NOT NULL COMMENT '分析批次 ID',
    marketplace VARCHAR(16) NOT NULL COMMENT '站点 UK/DE/US',
    bsr_id VARCHAR(64) NOT NULL COMMENT 'BSR 品类节点 ID',
    node_name VARCHAR(255) DEFAULT NULL COMMENT '节点名称',
    node_full_path VARCHAR(1000) DEFAULT NULL COMMENT '完整类目路径',

    archetype VARCHAR(64) DEFAULT NULL COMMENT '品线原型',
    archetype_method VARCHAR(128) DEFAULT NULL COMMENT '原型判定方法',
    lifecycle_stage VARCHAR(64) DEFAULT NULL COMMENT '生命周期阶段',
    lifecycle_window VARCHAR(128) DEFAULT NULL COMMENT '生命周期窗口',
    cr3 DECIMAL(8,4) DEFAULT NULL COMMENT 'CR3 竞争集中度 0-1',
    competition_pattern VARCHAR(128) DEFAULT NULL COMMENT '竞争格局',
    entry_barrier VARCHAR(128) DEFAULT NULL COMMENT '进入门槛',
    profit_margin DECIMAL(8,2) DEFAULT NULL COMMENT '典型利润率',
    profit_verdict VARCHAR(128) DEFAULT NULL COMMENT '利润判定',
    opportunity_score INT DEFAULT NULL COMMENT '机会评分 0-100',
    recommend_level VARCHAR(32) DEFAULT NULL COMMENT '推荐等级',
    go_no_go VARCHAR(32) DEFAULT NULL COMMENT 'Go/NoGo 判定',

    price_band_json LONGTEXT DEFAULT NULL COMMENT '价格带分析 JSON',
    score_breakdown_json LONGTEXT DEFAULT NULL COMMENT '评分分项明细 JSON',
    risk_rules_json LONGTEXT DEFAULT NULL COMMENT '风险硬规则 JSON',
    full_analysis_json LONGTEXT DEFAULT NULL COMMENT '完整分析结果 JSON',

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    PRIMARY KEY (id),
    KEY idx_product_line_batch (batch_id),
    KEY idx_product_line_marketplace_bsr (marketplace, bsr_id),
    KEY idx_product_line_score (opportunity_score),
    KEY idx_product_line_recommend (recommend_level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='品线指导记录';
