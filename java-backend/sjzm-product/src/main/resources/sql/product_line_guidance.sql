-- ═══════════════════════════════════════════════════════════════════
-- product_line_guidance 品线选品指导意见表
-- 存储 Agent 算法层分析结果（确定性算法 + LLM 解读）
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS `product_line_guidance` (
    `id`                    BIGINT          NOT NULL        COMMENT '主键ID（雪花算法）',
    `batch_id`              VARCHAR(64)     NOT NULL        COMMENT '批次ID（如 2026-W24）',
    `marketplace`           VARCHAR(16)     NOT NULL DEFAULT 'UK' COMMENT '站点（UK/DE）',

    -- 品类标识
    `bsr_id`                VARCHAR(64)     DEFAULT NULL    COMMENT 'BSR品类节点ID',
    `node_name`             VARCHAR(256)    DEFAULT NULL    COMMENT '品类名称',
    `node_full_path`        VARCHAR(512)    DEFAULT NULL    COMMENT '品类完整路径',

    -- 算法层：品类原型
    `archetype`             VARCHAR(16)     DEFAULT 'UNKNOWN' COMMENT '品类原型（DA/FH/FP/TN/PE/PS）',
    `archetype_method`      VARCHAR(32)     DEFAULT NULL    COMMENT '原型匹配方式（EXACT/KEYWORD/UNKNOWN）',

    -- 算法层：生命周期
    `lifecycle_stage`       VARCHAR(32)     DEFAULT NULL    COMMENT '生命周期阶段',
    `lifecycle_window`      VARCHAR(16)     DEFAULT NULL    COMMENT '切入窗口（BEST/GOOD/CLOSING/CLOSED）',

    -- 算法层：CR3竞争
    `cr3`                   DECIMAL(6,4)    DEFAULT NULL    COMMENT 'CR3竞争集中度（0-1）',
    `competition_pattern`   VARCHAR(32)     DEFAULT NULL    COMMENT '竞争格局（FRAGMENTED/MODERATE/OLIGOPOLY/MONOPOLY）',
    `entry_barrier`         VARCHAR(16)     DEFAULT NULL    COMMENT '进入壁垒（LOW/MEDIUM/HIGH/VERY_HIGH）',

    -- 算法层：利润
    `profit_margin`         DECIMAL(8,2)    DEFAULT NULL    COMMENT '典型利润率(%)',
    `profit_verdict`        VARCHAR(16)     DEFAULT NULL    COMMENT '利润判定（PROFITABLE/MARGINAL/UNPROFITABLE）',

    -- 算法层：评分
    `opportunity_score`     INT             DEFAULT 0       COMMENT '机会评分（0-100）',
    `recommend_level`       VARCHAR(32)     DEFAULT 'WATCH' COMMENT '推荐等级（STRONGLY_RECOMMEND/RECOMMEND/WATCH/AVOID）',
    `go_no_go`              VARCHAR(16)     DEFAULT 'WAIT_AND_SEE' COMMENT 'Go/NoGo判定',

    -- JSON 详情字段
    `price_band_json`       TEXT            DEFAULT NULL    COMMENT '价格带分析JSON',
    `score_breakdown_json`  TEXT            DEFAULT NULL    COMMENT '评分分项明细JSON',
    `risk_rules_json`       TEXT            DEFAULT NULL    COMMENT '风险硬规则JSON',
    `full_analysis_json`    MEDIUMTEXT      DEFAULT NULL    COMMENT '完整分析结果JSON',

    -- 时间戳
    `created_at`            DATETIME        DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at`            DATETIME        DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    PRIMARY KEY (`id`),
    INDEX `idx_batch_id` (`batch_id`),
    INDEX `idx_bsr_id` (`bsr_id`),
    INDEX `idx_recommend_level` (`recommend_level`),
    INDEX `idx_opportunity_score` (`opportunity_score` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='品线选品指导意见表 — Agent算法层分析结果';
