-- ============================================
-- 郑总店铺模型 — 分析批次 + 品线元素
-- ============================================

-- 1. 分析批次表（统一存储，batch_type 区分类型）
CREATE TABLE IF NOT EXISTS analysis_batches (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    batch_id        VARCHAR(64)  NOT NULL COMMENT '批次ID（如 UK_202605_zheng_model_20260610-120000）',
    batch_type      VARCHAR(32)  NOT NULL COMMENT '批次类型: zheng_model/product_line/category_scan/seller_scan/new_products',
    marketplace     VARCHAR(8)   NOT NULL COMMENT '站点 UK/DE/US',
    month           VARCHAR(8)   NOT NULL COMMENT '数据月份 202605',

    -- 元数据
    source_table    VARCHAR(64)  COMMENT '数据源表（deng_zong_shop/competitor_products）',
    total_products  INT DEFAULT 0 COMMENT '原始数据总量',
    total_items     INT DEFAULT 0 COMMENT '聚合后的条目数（如小类数）',

    -- 核心数据
    data_json       MEDIUMTEXT   NOT NULL COMMENT '结构化分析数据 JSON',

    -- 状态
    status          VARCHAR(16)  DEFAULT 'ready' COMMENT 'ready/analyzing/done/error',
    error_message   TEXT         COMMENT '错误信息',
    analyzed_at     DATETIME     COMMENT 'Agent 分析完成时间',
    created_at      DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_batch (batch_id),
    INDEX idx_type_marketplace_month (batch_type, marketplace, month),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='分析批次表 — 基准数据包 + Agent 分析结果';

-- 2. 品线元素表（AI 判定的好品，is_winner=1 才写入）
CREATE TABLE IF NOT EXISTS product_line_elements (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    marketplace     VARCHAR(8)   NOT NULL,
    month           VARCHAR(8)   NOT NULL,
    bsr_id          VARCHAR(64),
    node_id         BIGINT,
    node_name       VARCHAR(128),
    asin            VARCHAR(20),
    title           VARCHAR(512),

    -- 基准数值（前端筛选排序用）
    listing_days    INT,
    units           INT,
    bsr             INT,
    price           DECIMAL(8,2),
    variations      INT,

    -- AI 分析结果
    signal_tags     JSON         COMMENT '信号标签 ["STABLE","VARIANT","SWEET_SPOT"]',
    elements        JSON         COMMENT '元素 ["heart","thank-you"] (原标题语言)',
    carriers        JSON         COMMENT '载体 ["ceramic-plaque"]',
    scenes          JSON         COMMENT '场景 ["women","friend"]',
    is_winner       TINYINT      DEFAULT 0,
    ai_keywords     JSON         COMMENT 'AI生成的中文关键词 ["爱心陶瓷牌"]',
    analysis_batch_id VARCHAR(64),

    created_at      DATETIME     DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_bsr_node (bsr_id, node_id),
    INDEX idx_batch (analysis_batch_id),
    INDEX idx_asin (asin),
    UNIQUE KEY uk_batch_asin (analysis_batch_id, asin)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='品线元素表 — AI判定的好品关联';


-- 3. 基准数据版本表（数据版本决定模型版本）
CREATE TABLE IF NOT EXISTS reference_data_versions (
    id              INT PRIMARY KEY AUTO_INCREMENT,
    source_table    VARCHAR(64)  NOT NULL COMMENT '数据源表 deng_zong_shop',
    marketplace     VARCHAR(8)   NOT NULL COMMENT '站点 UK/DE',
    data_version    INT          NOT NULL DEFAULT 1 COMMENT '数据版本号 v1/v2/...',
    data_month      VARCHAR(8)   COMMENT '当前数据月份',
    record_count    INT          COMMENT '导入记录数',
    imported_at     DATETIME     DEFAULT CURRENT_TIMESTAMP,
    notes           VARCHAR(256) COMMENT '备注',

    UNIQUE KEY uk_source_market (source_table, marketplace)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='基准数据版本 — 数据变了版本才变，模型版本对齐此表';
