-- ═══════════════════════════════════════════════════════════════════
-- 6 张缺失表的建表语句（选品 Agent 算法层分析结果存储）
-- 执行: mysql -u sijue -p sijuelishi_dev < add_missing_tables.sql
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- 1. blue_ocean_scan_results 蓝海机会扫描结果表
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `blue_ocean_scan_results` (
    `id`                   BIGINT          NOT NULL AUTO_INCREMENT  COMMENT '主键ID',
    `marketplace`          VARCHAR(16)     NOT NULL DEFAULT 'UK'    COMMENT '站点（UK/DE）',
    `month`                VARCHAR(8)      NOT NULL                 COMMENT '数据月份（如 202605）',
    `category`             VARCHAR(256)    DEFAULT NULL             COMMENT '品类名称',
    `opportunity_type`     VARCHAR(32)     DEFAULT NULL             COMMENT '机会类型',
    `blue_ocean_score`     DECIMAL(8,2)    DEFAULT NULL             COMMENT '蓝海机会评分',
    `radar_json`           TEXT            DEFAULT NULL             COMMENT '雷达图JSON',
    `recommendations_json` TEXT            DEFAULT NULL             COMMENT '推荐策略JSON',
    `created_at`           DATETIME        DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',

    PRIMARY KEY (`id`),
    INDEX `idx_marketplace_month` (`marketplace`, `month`),
    INDEX `idx_category` (`category`(64)),
    INDEX `idx_opportunity_type` (`opportunity_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='蓝海机会扫描结果表 — 跨品类蓝海发现';

-- ─────────────────────────────────────────────────────────────────
-- 2. category_baselines 品类百分位基线表
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `category_baselines` (
    `id`                   BIGINT          NOT NULL AUTO_INCREMENT  COMMENT '主键ID',
    `marketplace`          VARCHAR(16)     NOT NULL DEFAULT 'UK'    COMMENT '站点',
    `category_label`       VARCHAR(256)    DEFAULT NULL             COMMENT '品类标签',
    `archetype`            VARCHAR(16)     DEFAULT NULL             COMMENT '品类原型（DA/FH/FP/TN/PE/PS）',

    -- 样本统计
    `sample_size`          INT             DEFAULT 0                COMMENT '样本量',
    `baseline_month`       VARCHAR(8)      DEFAULT NULL             COMMENT '基线月份',

    -- 8维百分位基线（P25/P50/P75）
    `p25_size`             DECIMAL(10,2)   DEFAULT NULL             COMMENT 'size维度 P25',
    `p50_size`             DECIMAL(10,2)   DEFAULT NULL             COMMENT 'size维度 P50',
    `p75_size`             DECIMAL(10,2)   DEFAULT NULL             COMMENT 'size维度 P75',
    `p25_volume`           DECIMAL(10,2)   DEFAULT NULL             COMMENT 'volume维度 P25',
    `p50_volume`           DECIMAL(10,2)   DEFAULT NULL             COMMENT 'volume维度 P50',
    `p75_volume`           DECIMAL(10,2)   DEFAULT NULL             COMMENT 'volume维度 P75',
    `p25_profit`           DECIMAL(10,2)   DEFAULT NULL             COMMENT 'profit维度 P25',
    `p50_profit`           DECIMAL(10,2)   DEFAULT NULL             COMMENT 'profit维度 P50',
    `p75_profit`           DECIMAL(10,2)   DEFAULT NULL             COMMENT 'profit维度 P75',
    `p25_emotion`          DECIMAL(10,2)   DEFAULT NULL             COMMENT 'emotion维度 P25',
    `p50_emotion`          DECIMAL(10,2)   DEFAULT NULL             COMMENT 'emotion维度 P50',
    `p75_emotion`          DECIMAL(10,2)   DEFAULT NULL             COMMENT 'emotion维度 P75',
    `p25_decor`            DECIMAL(10,2)   DEFAULT NULL             COMMENT 'decor维度 P25',
    `p50_decor`            DECIMAL(10,2)   DEFAULT NULL             COMMENT 'decor维度 P50',
    `p75_decor`            DECIMAL(10,2)   DEFAULT NULL             COMMENT 'decor维度 P75',
    `p25_fission`          DECIMAL(10,2)   DEFAULT NULL             COMMENT 'fission维度 P25',
    `p50_fission`          DECIMAL(10,2)   DEFAULT NULL             COMMENT 'fission维度 P50',
    `p75_fission`          DECIMAL(10,2)   DEFAULT NULL             COMMENT 'fission维度 P75',
    `p25_culture`          DECIMAL(10,2)   DEFAULT NULL             COMMENT 'culture维度 P25',
    `p50_culture`          DECIMAL(10,2)   DEFAULT NULL             COMMENT 'culture维度 P50',
    `p75_culture`          DECIMAL(10,2)   DEFAULT NULL             COMMENT 'culture维度 P75',
    `p25_market`           DECIMAL(10,2)   DEFAULT NULL             COMMENT 'market维度 P25',
    `p50_market`           DECIMAL(10,2)   DEFAULT NULL             COMMENT 'market维度 P50',
    `p75_market`           DECIMAL(10,2)   DEFAULT NULL             COMMENT 'market维度 P75',

    -- 品类健康度指标
    `avg_growth_rate`      DECIMAL(8,4)    DEFAULT NULL             COMMENT '平均增速',
    `avg_cr3`              DECIMAL(6,4)    DEFAULT NULL             COMMENT '平均CR3集中度',
    `avg_margin`           DECIMAL(8,2)    DEFAULT NULL             COMMENT '平均利润率(%)',
    `avg_rating`           DECIMAL(4,2)    DEFAULT NULL             COMMENT '平均评分',
    `total_products`       INT             DEFAULT 0                COMMENT '产品总数',

    -- 元数据
    `computed_at`          DATETIME        DEFAULT NULL             COMMENT '计算时间',
    `data_source`          VARCHAR(32)     DEFAULT NULL             COMMENT '数据来源',
    `confidence`           DECIMAL(6,4)    DEFAULT NULL             COMMENT '置信度',
    `created_at`           DATETIME        DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',

    PRIMARY KEY (`id`),
    INDEX `idx_marketplace_category` (`marketplace`, `category_label`(64)),
    INDEX `idx_archetype` (`archetype`),
    INDEX `idx_baseline_month` (`baseline_month`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='品类百分位基线表 — 8维P25/P50/P75百分位评分基准';

-- ─────────────────────────────────────────────────────────────────
-- 3. category_heat_matrix 品类热度矩阵表
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `category_heat_matrix` (
    `id`                   BIGINT          NOT NULL AUTO_INCREMENT  COMMENT '主键ID',
    `marketplace`          VARCHAR(16)     NOT NULL DEFAULT 'UK'    COMMENT '站点',
    `month`                VARCHAR(8)      NOT NULL                 COMMENT '数据月份',
    `category`             VARCHAR(256)    DEFAULT NULL             COMMENT '品类名称',
    `dengzong_count`       INT             DEFAULT 0                COMMENT '郑总系卖家数',
    `external_s_count`     INT             DEFAULT 0                COMMENT '外部优质卖家数',
    `external_a_count`     INT             DEFAULT 0                COMMENT '外部普通卖家数',
    `total_seller_count`   INT             DEFAULT 0                COMMENT '总卖家数',
    `dengzong_ratio`       DECIMAL(6,4)    DEFAULT NULL             COMMENT '郑总系占比',
    `smart_density`        DECIMAL(6,4)    DEFAULT NULL             COMMENT '聪明密度',
    `heat_signal`          VARCHAR(16)     DEFAULT NULL             COMMENT '热度信号',
    `created_at`           DATETIME        DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',

    PRIMARY KEY (`id`),
    INDEX `idx_marketplace_month` (`marketplace`, `month`),
    INDEX `idx_category` (`category`(64)),
    INDEX `idx_heat_signal` (`heat_signal`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='品类热度矩阵表 — 跨品类卖家活跃度和竞争温度';

-- ─────────────────────────────────────────────────────────────────
-- 4. follow_signals 跟品信号表
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `follow_signals` (
    `id`                   BIGINT          NOT NULL AUTO_INCREMENT  COMMENT '主键ID',
    `marketplace`          VARCHAR(16)     NOT NULL DEFAULT 'UK'    COMMENT '站点',
    `month`                VARCHAR(8)      NOT NULL                 COMMENT '数据月份',
    `category`             VARCHAR(256)    DEFAULT NULL             COMMENT '品类名称',
    `first_seller`         VARCHAR(200)    DEFAULT NULL             COMMENT '首发卖家',
    `first_asin`           VARCHAR(20)     DEFAULT NULL             COMMENT '首发ASIN',
    `first_listing_days`   INT             DEFAULT 0                COMMENT '首发上架天数',
    `follower_count`       INT             DEFAULT 0                COMMENT '跟品卖家数',
    `smart_follower_count` INT             DEFAULT 0                COMMENT '优质跟品卖家数',
    `signal_strength`      VARCHAR(16)     DEFAULT NULL             COMMENT '信号强度',
    `created_at`           DATETIME        DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',

    PRIMARY KEY (`id`),
    INDEX `idx_marketplace_month` (`marketplace`, `month`),
    INDEX `idx_category` (`category`(64)),
    INDEX `idx_signal_strength` (`signal_strength`),
    INDEX `idx_first_asin` (`first_asin`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='跟品信号表 — ASIN级跟品信号和趋势追踪';

-- ─────────────────────────────────────────────────────────────────
-- 5. seller_profiles 卖家画像表
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `seller_profiles` (
    `id`                   BIGINT          NOT NULL AUTO_INCREMENT  COMMENT '主键ID',
    `marketplace`          VARCHAR(16)     NOT NULL DEFAULT 'UK'    COMMENT '站点',
    `month`                VARCHAR(8)      NOT NULL                 COMMENT '数据月份',
    `seller_name`          VARCHAR(200)    NOT NULL                 COMMENT '卖家名称',
    `is_dengzong`          TINYINT         DEFAULT 0                COMMENT '是否郑总系（0/1）',
    `smart_score`          DECIMAL(8,2)    DEFAULT NULL             COMMENT '聪明分',
    `vision_score`         DECIMAL(8,2)    DEFAULT NULL             COMMENT '视野分',
    `new_success_rate`     DECIMAL(6,4)    DEFAULT NULL             COMMENT '新品成功率',
    `profit_percentile`    DECIMAL(6,4)    DEFAULT NULL             COMMENT '利润率百分位',
    `grade`                VARCHAR(8)      DEFAULT NULL             COMMENT '评级别（S/A/B/C/D）',
    `archetype`            VARCHAR(16)     DEFAULT NULL             COMMENT '擅长品类原型',
    `product_count`        INT             DEFAULT 0                COMMENT '产品数',
    `new_product_count`    INT             DEFAULT 0                COMMENT '新品数',
    `avg_units`            DECIMAL(10,2)   DEFAULT NULL             COMMENT '平均月销',
    `avg_bsr`              INT             DEFAULT 0                COMMENT '平均BSR',
    `category_focus`       VARCHAR(256)    DEFAULT NULL             COMMENT '主营品类',
    `created_at`           DATETIME        DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at`           DATETIME        DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    PRIMARY KEY (`id`),
    INDEX `idx_marketplace_month` (`marketplace`, `month`),
    INDEX `idx_seller_name` (`seller_name`(64)),
    INDEX `idx_grade` (`grade`),
    INDEX `idx_archetype` (`archetype`),
    INDEX `idx_smart_score` (`smart_score` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='卖家画像表 — 跨品类卖家能力建模';

-- ─────────────────────────────────────────────────────────────────
-- 6. selection_decisions 选品决策记录表（反馈闭环核心）
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `selection_decisions` (
    `id`                   BIGINT          NOT NULL AUTO_INCREMENT  COMMENT '主键ID',

    -- 产品标识
    `marketplace`          VARCHAR(16)     NOT NULL DEFAULT 'UK'    COMMENT '站点',
    `asin`                 VARCHAR(20)     NOT NULL                 COMMENT 'ASIN',
    `decision_month`       VARCHAR(8)      NOT NULL                 COMMENT '决策月份',

    -- 品类信息
    `category_label`       VARCHAR(256)    DEFAULT NULL             COMMENT '品类标签',
    `category_prototype`   VARCHAR(16)     DEFAULT NULL             COMMENT '品类原型',

    -- 评分快照（决策时刻的8维分数）
    `selection_score`      INT             DEFAULT 0                COMMENT '选品综合评分（0-100）',
    `selection_grade`      VARCHAR(4)      DEFAULT NULL             COMMENT '选品等级（S/A/B/C/D）',
    `sel_size_score`       TINYINT         DEFAULT NULL             COMMENT 'size维度分（0-100）',
    `sel_volume_score`     TINYINT         DEFAULT NULL             COMMENT 'volume维度分',
    `sel_profit_score`     TINYINT         DEFAULT NULL             COMMENT 'profit维度分',
    `sel_emotion_score`    TINYINT         DEFAULT NULL             COMMENT 'emotion维度分',
    `sel_decor_score`      TINYINT         DEFAULT NULL             COMMENT 'decor维度分',
    `sel_fission_score`    TINYINT         DEFAULT NULL             COMMENT 'fission维度分',
    `sel_culture_score`    TINYINT         DEFAULT NULL             COMMENT 'culture维度分',
    `sel_market_score`     TINYINT         DEFAULT NULL             COMMENT 'market维度分',

    -- 决策快照
    `decision_score`       DECIMAL(8,2)    DEFAULT NULL             COMMENT '最终决策分',
    `decision_status`      VARCHAR(16)     DEFAULT NULL             COMMENT '决策状态（SELECT/PASS/PENDING）',
    `signal_boosts`        TEXT            DEFAULT NULL             COMMENT '信号加成JSON',

    -- 决策时基线数据（3个月后对比用）
    `baseline_bsr`         INT             DEFAULT 0                COMMENT '决策时BSR',
    `baseline_units`       INT             DEFAULT 0                COMMENT '决策时月销',
    `baseline_price`       DECIMAL(10,2)   DEFAULT NULL             COMMENT '决策时价格',
    `baseline_ratings`     INT             DEFAULT 0                COMMENT '决策时评论数',

    -- 验证结果（3个月后填充）
    `verify_month`         VARCHAR(8)      DEFAULT NULL             COMMENT '验证月份',
    `verify_bsr`           INT             DEFAULT NULL             COMMENT '验证时BSR',
    `verify_units`         INT             DEFAULT NULL             COMMENT '验证时月销',
    `verify_price`         DECIMAL(10,2)   DEFAULT NULL             COMMENT '验证时价格',
    `verify_ratings`       INT             DEFAULT NULL             COMMENT '验证时评论数',

    -- 验证判定
    `outcome`              VARCHAR(16)     DEFAULT NULL             COMMENT '验证结果（SUCCESS/NEUTRAL/FAIL/PENDING）',
    `outcome_detail`       TEXT            DEFAULT NULL             COMMENT '验证详情JSON',

    -- 元数据
    `created_at`           DATETIME        DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `verified_at`          DATETIME        DEFAULT NULL             COMMENT '验证时间',
    `verified_by`          VARCHAR(64)     DEFAULT NULL             COMMENT '验证人',

    PRIMARY KEY (`id`),
    INDEX `idx_asin_marketplace` (`asin`, `marketplace`),
    INDEX `idx_decision_month` (`decision_month`),
    INDEX `idx_decision_status` (`decision_status`),
    INDEX `idx_outcome` (`outcome`),
    INDEX `idx_selection_score` (`selection_score` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='选品决策记录表 — 反馈闭环核心，记录ASIN级选品决策快照和3月验证';
