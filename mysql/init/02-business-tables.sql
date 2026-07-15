-- ============================================================
-- 业务表初始化脚本（Docker mysql/init 自动执行）
-- 所有 Java 后端 @TableName 引用的业务表均在此创建
-- ============================================================

-- ═══════════════════════════════════════════════════════════
-- 1. competitor_products — 竞品数据表（核心，Agent 数据源）
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS `competitor_products` (
    `id`                  BIGINT          NOT NULL        COMMENT '主键（雪花算法）',
    `marketplace`         VARCHAR(10)     NOT NULL        COMMENT '站点 UK/DE/US',
    `asin`                VARCHAR(20)     NOT NULL        COMMENT 'ASIN',
    `month`               VARCHAR(10)     NOT NULL        COMMENT '数据月份 如 2026-06',
    `title`               VARCHAR(500)    DEFAULT NULL    COMMENT '产品标题',
    `brand`               VARCHAR(200)    DEFAULT NULL    COMMENT '品牌',
    `brand_url`           VARCHAR(500)    DEFAULT NULL    COMMENT '品牌链接',
    `image_url`           VARCHAR(500)    DEFAULT NULL    COMMENT '图片URL',
    `parent_asin`         VARCHAR(20)     DEFAULT NULL    COMMENT '父ASIN',
    `sku`                 VARCHAR(50)     DEFAULT NULL    COMMENT 'SKU',
    `node_id`             BIGINT          DEFAULT NULL    COMMENT 'BSR节点ID',
    `node_id_path`        VARCHAR(200)    DEFAULT NULL    COMMENT '节点ID路径',
    `node_label_path`     VARCHAR(500)    DEFAULT NULL    COMMENT '节点标签路径',
    `symbol`              VARCHAR(50)     DEFAULT NULL    COMMENT '符号标记',

    -- 销量/收入
    `units`               INT             DEFAULT NULL    COMMENT '月销量',
    `units_gr`            DECIMAL(8,4)    DEFAULT NULL    COMMENT '销量增长率',
    `amz_unit`            INT             DEFAULT NULL    COMMENT 'Amazon自营销量',
    `amz_sales`           DECIMAL(12,2)   DEFAULT NULL    COMMENT 'Amazon自营销售额',
    `amz_unit_date`       BIGINT          DEFAULT NULL    COMMENT 'Amazon销量日期',
    `revenue`             DECIMAL(12,2)   DEFAULT NULL    COMMENT '月收入',

    -- BSR
    `bsr_id`              VARCHAR(64)     DEFAULT NULL    COMMENT 'BSR品类节点ID',
    `bsr`                 INT             DEFAULT NULL    COMMENT 'BSR排名',
    `bsr_cr`              DECIMAL(8,4)    DEFAULT NULL    COMMENT 'BSR变化率',
    `bsr_cv`              INT             DEFAULT NULL    COMMENT 'BSR变化值',

    -- 评分/评论
    `ratings`             INT             DEFAULT NULL    COMMENT '评论数',
    `rating`              DECIMAL(3,2)    DEFAULT NULL    COMMENT '评分',
    `ratings_rate`        DECIMAL(8,4)    DEFAULT NULL    COMMENT '评论增长率',
    `ratings_cv`          INT             DEFAULT NULL    COMMENT '评论变化值',
    `rating_delta`        INT             DEFAULT NULL    COMMENT '评分变化',

    -- 价格/利润
    `price`               DECIMAL(10,2)   DEFAULT NULL    COMMENT '售价',
    `prime_price`         DECIMAL(10,2)   DEFAULT NULL    COMMENT 'Prime价格',
    `profit`              DECIMAL(10,2)   DEFAULT NULL    COMMENT '利润',
    `fba`                 DECIMAL(10,2)   DEFAULT NULL    COMMENT 'FBA费用',
    `delivery_price`      DECIMAL(10,2)   DEFAULT NULL    COMMENT '配送费',

    -- 卖家
    `seller_name`         VARCHAR(200)    DEFAULT NULL    COMMENT '卖家名称',
    `seller_id`           VARCHAR(50)     DEFAULT NULL    COMMENT '卖家ID',
    `seller_nation`       VARCHAR(10)     DEFAULT NULL    COMMENT '卖家国籍',
    `sellers`             INT             DEFAULT NULL    COMMENT '卖家数量',

    -- 物流/包装
    `fulfillment`         VARCHAR(20)     DEFAULT NULL    COMMENT '配送方式 FBA/FBM',
    `variations`          INT             DEFAULT NULL    COMMENT '变体数',
    `weight`              VARCHAR(50)     DEFAULT NULL    COMMENT '重量(原始)',
    `dimension`           VARCHAR(50)     DEFAULT NULL    COMMENT '尺寸(原始)',
    `dimensions_type`     VARCHAR(20)     DEFAULT NULL    COMMENT '尺寸类型',
    `pkg_dimensions`      VARCHAR(100)    DEFAULT NULL    COMMENT '包装尺寸',
    `pkg_dimension_type`  VARCHAR(20)     DEFAULT NULL    COMMENT '包装尺寸类型',
    `pkg_weight`          VARCHAR(50)     DEFAULT NULL    COMMENT '包装重量',

    -- 其他指标
    `lqs`                 DECIMAL(8,2)    DEFAULT NULL    COMMENT 'LQS评分',
    `available_date`      BIGINT          DEFAULT NULL    COMMENT '上架日期戳',

    -- 标签
    `best_seller`         VARCHAR(5)      DEFAULT NULL    COMMENT 'BestSeller标记 1/Y',
    `amazon_choice`       VARCHAR(5)      DEFAULT NULL    COMMENT 'AmazonChoice标记 1/Y',
    `new_release`         VARCHAR(5)      DEFAULT NULL    COMMENT 'NewRelease标记',
    `ebc`                 VARCHAR(5)      DEFAULT NULL    COMMENT 'A+页面标记',
    `video`               VARCHAR(5)      DEFAULT NULL    COMMENT '视频标记',

    -- 筛选衍生字段
    `filter_mode`         VARCHAR(20)     DEFAULT NULL    COMMENT '筛选模式',
    `filter_reasons`      VARCHAR(500)    DEFAULT NULL    COMMENT '被筛原因',
    `listing_days`        INT             DEFAULT NULL    COMMENT '上架天数',
    `weight_g`            DECIMAL(10,2)   DEFAULT NULL    COMMENT '重量(克)',
    `product_url`         VARCHAR(500)    DEFAULT NULL    COMMENT '产品链接',
    `similar_url`         VARCHAR(500)    DEFAULT NULL    COMMENT '相似品链接',
    `source`              VARCHAR(50)     DEFAULT NULL    COMMENT '数据来源',

    -- 评分字段
    `score`               INT             DEFAULT NULL    COMMENT '综合评分(0-100)',
    `grade`               VARCHAR(2)      DEFAULT NULL    COMMENT '等级(S/A/B/C/D)',
    `week_tag`            VARCHAR(10)     DEFAULT NULL    COMMENT 'ISO周标记(2026-W19)',
    `is_current`          INT             DEFAULT 0       COMMENT '是否本周数据(1=是,0=否)',

    -- 时间戳
    `created_at`          DATETIME        DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at`          DATETIME        DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_marketplace_asin_month` (`marketplace`, `asin`, `month`),
    INDEX `idx_marketplace` (`marketplace`),
    INDEX `idx_asin` (`asin`),
    INDEX `idx_parent_asin` (`parent_asin`),
    INDEX `idx_node_id` (`node_id`),
    INDEX `idx_bsr_id` (`bsr_id`),
    INDEX `idx_week_tag` (`week_tag`),
    INDEX `idx_is_current` (`is_current`),
    INDEX `idx_brand` (`brand`),
    INDEX `idx_seller_name` (`seller_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='竞品数据表 — Agent选品分析数据源';

-- ═══════════════════════════════════════════════════════════
-- 2. product_line_guidance — 品线选品指导意见表
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS `product_line_guidance` (
    `id`                    BIGINT          NOT NULL        COMMENT '主键ID（雪花算法）',
    `batch_id`              VARCHAR(64)     NOT NULL        COMMENT '批次ID（如 2026-W24）',
    `marketplace`           VARCHAR(16)     NOT NULL DEFAULT 'UK' COMMENT '站点（UK/DE）',
    `bsr_id`                VARCHAR(64)     DEFAULT NULL    COMMENT 'BSR品类节点ID',
    `node_name`             VARCHAR(256)    DEFAULT NULL    COMMENT '品类名称',
    `node_full_path`        VARCHAR(512)    DEFAULT NULL    COMMENT '品类完整路径',
    `archetype`             VARCHAR(16)     DEFAULT 'UNKNOWN' COMMENT '品类原型',
    `archetype_method`      VARCHAR(32)     DEFAULT NULL    COMMENT '原型匹配方式',
    `lifecycle_stage`       VARCHAR(32)     DEFAULT NULL    COMMENT '生命周期阶段',
    `lifecycle_window`      VARCHAR(16)     DEFAULT NULL    COMMENT '切入窗口',
    `cr3`                   DECIMAL(6,4)    DEFAULT NULL    COMMENT 'CR3竞争集中度(0-1)',
    `competition_pattern`   VARCHAR(32)     DEFAULT NULL    COMMENT '竞争格局',
    `entry_barrier`         VARCHAR(16)     DEFAULT NULL    COMMENT '进入壁垒',
    `profit_margin`         DECIMAL(8,2)    DEFAULT NULL    COMMENT '典型利润率(%)',
    `profit_verdict`        VARCHAR(16)     DEFAULT NULL    COMMENT '利润判定',
    `opportunity_score`     INT             DEFAULT 0       COMMENT '机会评分(0-100)',
    `recommend_level`       VARCHAR(32)     DEFAULT 'WATCH' COMMENT '推荐等级',
    `go_no_go`              VARCHAR(16)     DEFAULT 'WAIT_AND_SEE' COMMENT 'Go/NoGo判定',
    `price_band_json`       TEXT            DEFAULT NULL    COMMENT '价格带分析JSON',
    `score_breakdown_json`  TEXT            DEFAULT NULL    COMMENT '评分分项明细JSON',
    `risk_rules_json`       TEXT            DEFAULT NULL    COMMENT '风险硬规则JSON',
    `full_analysis_json`    MEDIUMTEXT      DEFAULT NULL    COMMENT '完整分析结果JSON',
    `created_at`            DATETIME        DEFAULT CURRENT_TIMESTAMP,
    `updated_at`            DATETIME        DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_batch_id` (`batch_id`),
    INDEX `idx_bsr_id` (`bsr_id`),
    INDEX `idx_recommend_level` (`recommend_level`),
    INDEX `idx_opportunity_score` (`opportunity_score` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='品线选品指导意见表 — Agent算法层分析结果';

-- ═══════════════════════════════════════════════════════════
-- 3. category_baselines — 品类百分位基线表
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS `category_baselines` (
    `id`               BIGINT AUTO_INCREMENT PRIMARY KEY,
    `marketplace`      VARCHAR(10)     NOT NULL        COMMENT '站点 UK/DE/US',
    `category_label`   VARCHAR(200)    NOT NULL        COMMENT '品类名称（第2级）',
    `archetype`        VARCHAR(20)     DEFAULT NULL    COMMENT '品类原型',
    `sample_size`      INT             DEFAULT 0       COMMENT '样本产品数',
    `baseline_month`   VARCHAR(7)      NOT NULL        COMMENT '基线月份 如 2026-06',
    `p25_size`         DECIMAL(12,2)   DEFAULT NULL    COMMENT '体积友好性 P25 (g)',
    `p50_size`         DECIMAL(12,2)   DEFAULT NULL    COMMENT '体积友好性 P50 (g)',
    `p75_size`         DECIMAL(12,2)   DEFAULT NULL    COMMENT '体积友好性 P75 (g)',
    `p25_volume`       DECIMAL(12,2)   DEFAULT NULL    COMMENT '销量/市场容量 P25',
    `p50_volume`       DECIMAL(12,2)   DEFAULT NULL    COMMENT '销量/市场容量 P50',
    `p75_volume`       DECIMAL(12,2)   DEFAULT NULL    COMMENT '销量/市场容量 P75',
    `p25_profit`       DECIMAL(12,2)   DEFAULT NULL    COMMENT '利润率 P25',
    `p50_profit`       DECIMAL(12,2)   DEFAULT NULL    COMMENT '利润率 P50',
    `p75_profit`       DECIMAL(12,2)   DEFAULT NULL    COMMENT '利润率 P75',
    `p25_emotion`      DECIMAL(5,2)    DEFAULT NULL    COMMENT '情绪价值 P25',
    `p50_emotion`      DECIMAL(5,2)    DEFAULT NULL    COMMENT '情绪价值 P50',
    `p75_emotion`      DECIMAL(5,2)    DEFAULT NULL    COMMENT '情绪价值 P75',
    `p25_decor`        DECIMAL(5,2)    DEFAULT NULL    COMMENT '装饰性 P25',
    `p50_decor`        DECIMAL(5,2)    DEFAULT NULL    COMMENT '装饰性 P50',
    `p75_decor`        DECIMAL(5,2)    DEFAULT NULL    COMMENT '装饰性 P75',
    `p25_fission`      DECIMAL(5,2)    DEFAULT NULL    COMMENT '裂变潜力 P25',
    `p50_fission`      DECIMAL(5,2)    DEFAULT NULL    COMMENT '裂变潜力 P50',
    `p75_fission`      DECIMAL(5,2)    DEFAULT NULL    COMMENT '裂变潜力 P75',
    `p25_culture`      DECIMAL(5,2)    DEFAULT NULL    COMMENT '文化适应性 P25',
    `p50_culture`      DECIMAL(5,2)    DEFAULT NULL    COMMENT '文化适应性 P50',
    `p75_culture`      DECIMAL(5,2)    DEFAULT NULL    COMMENT '文化适应性 P75',
    `p25_market`       DECIMAL(5,2)    DEFAULT NULL    COMMENT '市场指标 P25',
    `p50_market`       DECIMAL(5,2)    DEFAULT NULL    COMMENT '市场指标 P50',
    `p75_market`       DECIMAL(5,2)    DEFAULT NULL    COMMENT '市场指标 P75',
    `avg_growth_rate`  DECIMAL(8,4)    DEFAULT NULL    COMMENT '品类平均增速',
    `avg_cr3`          DECIMAL(5,4)    DEFAULT NULL    COMMENT '品类平均CR3',
    `avg_margin`       DECIMAL(8,4)    DEFAULT NULL    COMMENT '品类平均利润率',
    `avg_rating`       DECIMAL(3,2)    DEFAULT NULL    COMMENT '品类平均评分',
    `total_products`   INT             DEFAULT NULL    COMMENT '品类总产品数',
    `computed_at`      DATETIME        DEFAULT CURRENT_TIMESTAMP,
    `data_source`      VARCHAR(50)     DEFAULT 'auto',
    `confidence`       DECIMAL(3,2)    DEFAULT 0.80,
    UNIQUE KEY `uk_baseline` (`marketplace`, `category_label`, `baseline_month`),
    INDEX `idx_archetype` (`archetype`),
    INDEX `idx_baseline_month` (`baseline_month`),
    INDEX `idx_marketplace` (`marketplace`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='品类百分位基线表 - 动态评分基准';

-- ═══════════════════════════════════════════════════════════
-- 4. deng_zong_shop — 邓总店铺竞品数据（与 competitor_products 结构相近）
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS `deng_zong_shop` (
    `id`                  BIGINT          NOT NULL AUTO_INCREMENT,
    `marketplace`         VARCHAR(10)     NOT NULL,
    `asin`                VARCHAR(20)     NOT NULL,
    `month`               VARCHAR(10)     NOT NULL,
    `title`               VARCHAR(500)    DEFAULT NULL,
    `brand`               VARCHAR(200)    DEFAULT NULL,
    `brand_url`           VARCHAR(500)    DEFAULT NULL,
    `image_url`           VARCHAR(500)    DEFAULT NULL,
    `parent_asin`         VARCHAR(20)     DEFAULT NULL,
    `sku`                 VARCHAR(50)     DEFAULT NULL,
    `node_id`             BIGINT          DEFAULT NULL,
    `node_id_path`        VARCHAR(200)    DEFAULT NULL,
    `node_label_path`     VARCHAR(500)    DEFAULT NULL,
    `symbol`              VARCHAR(50)     DEFAULT NULL,
    `units`               INT             DEFAULT NULL,
    `units_gr`            DECIMAL(8,4)    DEFAULT NULL,
    `amz_unit`            INT             DEFAULT NULL,
    `amz_sales`           DECIMAL(12,2)   DEFAULT NULL,
    `amz_unit_date`       BIGINT          DEFAULT NULL,
    `revenue`             DECIMAL(12,2)   DEFAULT NULL,
    `bsr_id`              VARCHAR(64)     DEFAULT NULL,
    `bsr`                 INT             DEFAULT NULL,
    `bsr_cr`              DECIMAL(8,4)    DEFAULT NULL,
    `bsr_cv`              INT             DEFAULT NULL,
    `ratings`             INT             DEFAULT NULL,
    `rating`              DECIMAL(3,2)    DEFAULT NULL,
    `ratings_rate`        DECIMAL(8,4)    DEFAULT NULL,
    `ratings_cv`          INT             DEFAULT NULL,
    `rating_delta`        INT             DEFAULT NULL,
    `price`               DECIMAL(10,2)   DEFAULT NULL,
    `prime_price`         DECIMAL(10,2)   DEFAULT NULL,
    `profit`              DECIMAL(10,2)   DEFAULT NULL,
    `fba`                 DECIMAL(10,2)   DEFAULT NULL,
    `delivery_price`      DECIMAL(10,2)   DEFAULT NULL,
    `seller_name`         VARCHAR(200)    DEFAULT NULL,
    `seller_id`           VARCHAR(50)     DEFAULT NULL,
    `seller_nation`       VARCHAR(10)     DEFAULT NULL,
    `sellers`             INT             DEFAULT NULL,
    `fulfillment`         VARCHAR(20)     DEFAULT NULL,
    `variations`          INT             DEFAULT NULL,
    `weight`              VARCHAR(50)     DEFAULT NULL,
    `dimension`           VARCHAR(50)     DEFAULT NULL,
    `dimensions_type`     VARCHAR(20)     DEFAULT NULL,
    `pkg_dimensions`      VARCHAR(100)    DEFAULT NULL,
    `pkg_dimension_type`  VARCHAR(20)     DEFAULT NULL,
    `pkg_weight`          VARCHAR(50)     DEFAULT NULL,
    `lqs`                 DECIMAL(8,2)    DEFAULT NULL,
    `available_date`      BIGINT          DEFAULT NULL,
    `best_seller`         VARCHAR(5)      DEFAULT NULL,
    `amazon_choice`       VARCHAR(5)      DEFAULT NULL,
    `new_release`         VARCHAR(5)      DEFAULT NULL,
    `ebc`                 VARCHAR(5)      DEFAULT NULL,
    `video`               VARCHAR(5)      DEFAULT NULL,
    `product_url`         VARCHAR(500)    DEFAULT NULL,
    `similar_url`         VARCHAR(500)    DEFAULT NULL,
    `source`              VARCHAR(50)     DEFAULT NULL,
    `created_at`          DATETIME        DEFAULT CURRENT_TIMESTAMP,
    `updated_at`          DATETIME        DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_marketplace_asin_month` (`marketplace`, `asin`, `month`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='邓总店铺竞品数据';

-- ═══════════════════════════════════════════════════════════
-- 5. selection_decisions — 选品决策记录表（反馈闭环）
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS `selection_decisions` (
    `id`                 BIGINT AUTO_INCREMENT PRIMARY KEY,
    `marketplace`        VARCHAR(10)     NOT NULL,
    `asin`               VARCHAR(20)     NOT NULL,
    `decision_month`     VARCHAR(7)      NOT NULL,
    `category_label`     VARCHAR(200)    DEFAULT NULL,
    `category_prototype` VARCHAR(20)     DEFAULT NULL,
    `selection_score`    INT             DEFAULT NULL,
    `selection_grade`    VARCHAR(2)      DEFAULT NULL,
    `sel_size_score`     TINYINT         DEFAULT NULL,
    `sel_volume_score`   TINYINT         DEFAULT NULL,
    `sel_profit_score`   TINYINT         DEFAULT NULL,
    `sel_emotion_score`  TINYINT         DEFAULT NULL,
    `sel_decor_score`    TINYINT         DEFAULT NULL,
    `sel_fission_score`  TINYINT         DEFAULT NULL,
    `sel_culture_score`  TINYINT         DEFAULT NULL,
    `sel_market_score`   TINYINT         DEFAULT NULL,
    `decision_score`     DECIMAL(3,1)    DEFAULT NULL,
    `decision_status`    VARCHAR(20)     DEFAULT NULL,
    `signal_boosts`      JSON            DEFAULT NULL,
    `baseline_bsr`       INT             DEFAULT NULL,
    `baseline_units`     INT             DEFAULT NULL,
    `baseline_price`     DECIMAL(8,2)    DEFAULT NULL,
    `baseline_ratings`   INT             DEFAULT NULL,
    `verify_month`       VARCHAR(7)      DEFAULT NULL,
    `verify_bsr`         INT             DEFAULT NULL,
    `verify_units`       INT             DEFAULT NULL,
    `verify_price`       DECIMAL(8,2)    DEFAULT NULL,
    `verify_ratings`     INT             DEFAULT NULL,
    `outcome`            VARCHAR(20)     DEFAULT NULL,
    `outcome_detail`     TEXT            DEFAULT NULL,
    `created_at`         DATETIME        DEFAULT CURRENT_TIMESTAMP,
    `verified_at`        DATETIME        DEFAULT NULL,
    `verified_by`        VARCHAR(50)     DEFAULT NULL,
    UNIQUE KEY `uk_decision` (`marketplace`, `asin`, `decision_month`),
    INDEX `idx_grade` (`selection_grade`),
    INDEX `idx_outcome` (`outcome`),
    INDEX `idx_verify_month` (`verify_month`),
    INDEX `idx_decision_month` (`decision_month`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='选品决策记录表 - 反馈闭环核心';

-- ═══════════════════════════════════════════════════════════
-- 5.1 developer_selection_library — 开发个人好品/差品库
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS `developer_selection_batch` (
    `id` BIGINT NOT NULL,
    `user_id` BIGINT NOT NULL,
    `developer_name` VARCHAR(100) NOT NULL,
    `bucket` VARCHAR(10) NOT NULL COMMENT 'GOOD/BAD',
    `batch_name` VARCHAR(50) NOT NULL,
    `batch_date` DATE NOT NULL,
    `deleted` TINYINT(1) NOT NULL DEFAULT 0,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_developer_bucket_batch` (`user_id`, `bucket`, `batch_name`, `deleted`),
    KEY `idx_batch_scope` (`user_id`, `bucket`, `deleted`, `batch_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='开发个人人工选品批次（好品/差品独立）';

CREATE TABLE IF NOT EXISTS `developer_selection_library` (
    `id` BIGINT NOT NULL,
    `user_id` BIGINT NOT NULL,
    `developer_name` VARCHAR(100) NOT NULL,
    `marketplace` VARCHAR(10) NOT NULL,
    `asin` VARCHAR(20) NOT NULL,
    `bucket` VARCHAR(10) NOT NULL COMMENT 'GOOD/BAD',
    `batch_id` BIGINT DEFAULT NULL COMMENT '人工批次ID，NULL为未分类',
    `origin_scene` VARCHAR(32) DEFAULT NULL,
    `origin_source` VARCHAR(100) DEFAULT NULL,
    `snapshot_key` VARCHAR(64) DEFAULT NULL,
    `title` VARCHAR(1000) DEFAULT NULL,
    `brand` VARCHAR(255) DEFAULT NULL,
    `image_url` VARCHAR(1000) DEFAULT NULL,
    `price` DECIMAL(12,2) DEFAULT NULL,
    `units` INT DEFAULT NULL,
    `bsr` INT DEFAULT NULL,
    `ratings` INT DEFAULT NULL,
    `rating` DECIMAL(4,2) DEFAULT NULL,
    `listing_days` INT DEFAULT NULL,
    `weight_g` DECIMAL(12,2) DEFAULT NULL,
    `seller_name` VARCHAR(255) DEFAULT NULL,
    `node_label_path` VARCHAR(2000) DEFAULT NULL,
    `product_url` VARCHAR(1000) DEFAULT NULL,
    `snapshot_json` LONGTEXT DEFAULT NULL,
    `deleted` TINYINT(1) NOT NULL DEFAULT 0,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_developer_marketplace_asin` (`user_id`, `marketplace`, `asin`),
    KEY `idx_developer_bucket` (`user_id`, `bucket`, `deleted`, `updated_at`),
    KEY `idx_developer_bucket_batch` (`user_id`, `bucket`, `batch_id`, `deleted`),
    KEY `idx_admin_bucket` (`bucket`, `marketplace`, `deleted`, `updated_at`),
    KEY `idx_marketplace_asin` (`marketplace`, `asin`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='开发个人人工选品库（好品/差品）';

-- ═══════════════════════════════════════════════════════════
-- 6. asin_import_tasks — ASIN导入任务表
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS `asin_import_tasks` (
    `id`                 BIGINT AUTO_INCREMENT PRIMARY KEY,
    `marketplace`        VARCHAR(10)     NOT NULL,
    `import_type`        VARCHAR(20)     DEFAULT 'ASIN'  COMMENT '导入类型: ASIN 或 SELLER',
    `task_status`        VARCHAR(20)     DEFAULT NULL,
    `total_count`        INT             DEFAULT 0,
    `pass_count`         INT             DEFAULT 0,
    `price_fail_count`   INT             DEFAULT 0,
    `review_fail_count`  INT             DEFAULT 0,
    `duplicate_count`    INT             DEFAULT 0,
    `skip_count`         INT             DEFAULT 0,
    `batch_total`        INT             DEFAULT 0,
    `batch_current`      INT             DEFAULT 0,
    `api_success`        INT             DEFAULT 0,
    `api_fail`           INT             DEFAULT 0,
    `api_requests_used`  INT             DEFAULT 0,
    `parent_asin_count`  INT             DEFAULT 0,
    `variant_asin_count` INT             DEFAULT 0,
    `data_month`         VARCHAR(10)     DEFAULT NULL,
    `error_message`      TEXT            DEFAULT NULL,
    `progress_log`       TEXT            DEFAULT NULL,
    `created_at`         DATETIME        DEFAULT CURRENT_TIMESTAMP,
    `updated_at`         DATETIME        DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ASIN导入任务表';

-- ═══════════════════════════════════════════════════════════
-- 7. asin_import_results — ASIN导入结果表
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS `asin_import_results` (
    `id`            BIGINT AUTO_INCREMENT PRIMARY KEY,
    `task_id`       BIGINT          NOT NULL,
    `asin`          VARCHAR(20)     DEFAULT NULL,
    `seller_name`   VARCHAR(200)    DEFAULT NULL COMMENT '卖家名（卖家导入时使用）',
    `title`         VARCHAR(500)    DEFAULT NULL,
    `price`         DECIMAL(10,2)   DEFAULT NULL,
    `review_count`  INT             DEFAULT NULL,
    `status`        VARCHAR(20)     DEFAULT NULL,
    `detail`        TEXT            DEFAULT NULL,
    INDEX `idx_task_id` (`task_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ASIN导入结果表';

-- ═══════════════════════════════════════════════════════════
-- 8. competitor_subcategories — 竞品子品类关联表
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS `competitor_subcategories` (
    `id`          BIGINT AUTO_INCREMENT PRIMARY KEY,
    `product_id`  BIGINT          DEFAULT NULL,
    `code`        VARCHAR(50)     DEFAULT NULL,
    `rank_value`  INT             DEFAULT NULL,
    `label`       VARCHAR(200)    DEFAULT NULL,
    INDEX `idx_product_id` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='竞品子品类关联表';

-- ═══════════════════════════════════════════════════════════
-- 9. competitor_lookup_log — 竞品查询日志
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS `competitor_lookup_log` (
    `id`             BIGINT AUTO_INCREMENT PRIMARY KEY,
    `marketplace`    VARCHAR(10)     DEFAULT NULL,
    `month`          VARCHAR(10)     DEFAULT NULL,
    `asins_count`    INT             DEFAULT NULL,
    `took_ms`        INT             DEFAULT NULL,
    `pages`          INT             DEFAULT NULL,
    `total`          INT             DEFAULT NULL,
    `api_status`     VARCHAR(20)     DEFAULT NULL,
    `error_message`  TEXT            DEFAULT NULL,
    `run_id`         VARCHAR(64)     DEFAULT NULL,
    `item_id`        BIGINT          DEFAULT NULL,
    `request_type`   VARCHAR(32)     DEFAULT NULL,
    `request_scope`  VARCHAR(512)    DEFAULT NULL,
    `attempt_no`     INT             DEFAULT NULL,
    `request_dispatched` TINYINT(1)  NOT NULL DEFAULT 0,
    `usage_confirmed` TINYINT(1)     NOT NULL DEFAULT 0,
    `error_code`     VARCHAR(32)     DEFAULT NULL,
    `error_summary`  VARCHAR(512)    DEFAULT NULL,
    `created_at`     DATETIME        DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_competitor_lookup_log_run_item` (`run_id`, `item_id`),
    KEY `idx_competitor_lookup_log_request_type_created` (`request_type`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='竞品查询日志';

-- ═══════════════════════════════════════════════════════════
-- 10. shops — 店铺表
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS `shops` (
    `id`          BIGINT AUTO_INCREMENT PRIMARY KEY,
    `shop_id`     VARCHAR(50)     DEFAULT NULL,
    `shop_name`   VARCHAR(200)    DEFAULT NULL,
    `shop_link`   VARCHAR(500)    DEFAULT NULL,
    `marketplace` VARCHAR(10)     DEFAULT NULL,
    `created_at`  DATETIME        DEFAULT CURRENT_TIMESTAMP,
    `updated_at`  DATETIME        DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='店铺表';

-- ═══════════════════════════════════════════════════════════
-- 11. store_ratings — 店铺评分表
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS `store_ratings` (
    `id`                  BIGINT AUTO_INCREMENT PRIMARY KEY,
    `seller_name`         VARCHAR(200)    DEFAULT NULL,
    `marketplace`         VARCHAR(10)     DEFAULT NULL,
    `rating_score`        DOUBLE          DEFAULT NULL,
    `rating_grade`        VARCHAR(5)      DEFAULT NULL,
    `best_match_seller`   VARCHAR(200)    DEFAULT NULL,
    `best_match_score`    DOUBLE          DEFAULT NULL,
    `product_count`       INT             DEFAULT NULL,
    `overall_score`       DOUBLE          DEFAULT NULL,
    `match_score`         DOUBLE          DEFAULT NULL,
    `rated_at`            DATETIME        DEFAULT NULL,
    INDEX `idx_seller_marketplace` (`seller_name`, `marketplace`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='店铺评分表';

-- ═══════════════════════════════════════════════════════════
-- 12. skip_asins — 被筛除的ASIN记录表
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS `skip_asins` (
    `id`              BIGINT          NOT NULL COMMENT '主键（雪花算法）',
    `asin`            VARCHAR(20)     NOT NULL,
    `title`           VARCHAR(500)    DEFAULT NULL,
    `image_url`       VARCHAR(500)    DEFAULT NULL,
    `price`           DECIMAL(10,2)   DEFAULT NULL,
    `bsr`             INT             DEFAULT NULL,
    `monthly_sales`   INT             DEFAULT NULL,
    `listing_days`    INT             DEFAULT NULL,
    `weight_g`        DECIMAL(10,2)   DEFAULT NULL,
    `fulfillment`     VARCHAR(20)     DEFAULT NULL,
    `seller_nation`   VARCHAR(10)     DEFAULT NULL,
    `filter_reasons`  VARCHAR(500)    DEFAULT NULL,
    `marketplace`     VARCHAR(10)     DEFAULT NULL,
    `created_at`      DATETIME        DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_asin` (`asin`),
    INDEX `idx_marketplace` (`marketplace`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='被筛除ASIN记录表';

-- ═══════════════════════════════════════════════════════════
-- 13. product_30day_new — 30天新品表
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS `product_30day_new` (
    `id`              BIGINT AUTO_INCREMENT PRIMARY KEY,
    `asin`            VARCHAR(20)     NOT NULL,
    `title`           VARCHAR(500)    DEFAULT NULL,
    `image_url`       VARCHAR(500)    DEFAULT NULL,
    `product_url`     VARCHAR(500)    DEFAULT NULL,
    `price`           DECIMAL(10,2)   DEFAULT NULL,
    `bsr`             INT             DEFAULT NULL,
    `monthly_sales`   INT             DEFAULT NULL,
    `listing_days`    INT             DEFAULT NULL,
    `shop_name`       VARCHAR(200)    DEFAULT NULL,
    `filter_status`   VARCHAR(20)     DEFAULT NULL,
    `filter_reasons`  VARCHAR(500)    DEFAULT NULL,
    `marketplace`     VARCHAR(10)     DEFAULT NULL,
    `data_month`      VARCHAR(10)     DEFAULT NULL,
    `created_at`      DATETIME        DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_asin` (`asin`),
    INDEX `idx_marketplace` (`marketplace`),
    INDEX `idx_data_month` (`data_month`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='30天新品表';

-- ═══════════════════════════════════════════════════════════
-- 14. api_config — API配置表
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS `api_config` (
    `id`            BIGINT AUTO_INCREMENT PRIMARY KEY,
    `config_key`    VARCHAR(100)    NOT NULL,
    `config_value`  TEXT            DEFAULT NULL,
    `config_type`   VARCHAR(50)     DEFAULT 'string' COMMENT '类型：string/number/JSON',
    `description`   VARCHAR(255)    DEFAULT NULL,
    UNIQUE KEY `uk_config_key` (`config_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='API配置表';

-- ═══════════════════════════════════════════════════════════
-- 15. scoring_config — 评分维度配置表
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS `scoring_config` (
    `id`             INT AUTO_INCREMENT PRIMARY KEY,
    `dimension_key`  VARCHAR(50)     NOT NULL UNIQUE,
    `display_name`   VARCHAR(100)    NOT NULL,
    `weight`         DECIMAL(5,2)    NOT NULL,
    `thresholds`     JSON            NOT NULL,
    `is_active`      TINYINT(1)      DEFAULT 1,
    `updated_at`     DATETIME        DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='评分维度配置表';

-- ═══════════════════════════════════════════════════════════
-- 16. grade_thresholds — 等级阈值配置表
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS `grade_thresholds` (
    `id`          INT AUTO_INCREMENT PRIMARY KEY,
    `grade`       VARCHAR(2)      NOT NULL UNIQUE,
    `min_score`   INT             NOT NULL,
    `max_score`   INT             NOT NULL,
    `color`       VARCHAR(20)     DEFAULT NULL,
    `updated_at`  DATETIME        DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='等级阈值配置表';

-- ═══════════════════════════════════════════════════════════
-- 17. product_click_log — 产品点击行为记录表
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS `product_click_log` (
    `id`              BIGINT AUTO_INCREMENT PRIMARY KEY,
    `user_id`         BIGINT          NOT NULL,
    `asin`            VARCHAR(20)     NOT NULL,
    `marketplace`     VARCHAR(10)     NOT NULL,
    `source`          VARCHAR(50)     DEFAULT '新品榜',
    `action`          VARCHAR(20)     NOT NULL COMMENT 'click=浏览, select=选中',
    `product_title`   VARCHAR(500)    DEFAULT NULL,
    `clicked_at`      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_user` (`user_id`),
    INDEX `idx_asin` (`asin`),
    INDEX `idx_source_action` (`source`, `action`, `clicked_at`),
    INDEX `idx_user_time` (`user_id`, `clicked_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='产品点击行为记录表';

-- ═══════════════════════════════════════════════════════════
-- 18. user_filter_presets — 用户筛选预设表
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS `user_filter_presets` (
    `id`            BIGINT AUTO_INCREMENT PRIMARY KEY,
    `user_id`       BIGINT          NOT NULL,
    `preset_name`   VARCHAR(50)     NOT NULL,
    `preset_index`  TINYINT         NOT NULL,
    `is_default`    TINYINT         DEFAULT 0,
    `filter_config` TEXT            DEFAULT NULL,
    `created_at`    DATETIME        DEFAULT CURRENT_TIMESTAMP,
    `updated_at`    DATETIME        DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_user_index` (`user_id`, `preset_index`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户筛选预设表';
