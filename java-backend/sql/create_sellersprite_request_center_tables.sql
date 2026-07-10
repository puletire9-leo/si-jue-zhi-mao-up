-- =================================================================
-- 卖家精灵请求中心 + 精品店铺池：sellersprite_request_run + _item + shop_premium_pool
-- =================================================================
-- 设计见 docs/店铺品级/店铺候选池与精品店铺池完整实施计划.md（请求中心补充）
-- =================================================================
-- 职责边界：
--   sellersprite_request_run  —— 一次批量请求任务（如精品池复抓、候选池大批量抓取、ASIN 补数）
--   sellersprite_request_item —— 任务下的每一条店铺/ASIN 子项，逐条消费、记录使用次数和成功失败
--   shop_premium_pool         —— 长期复用精品店铺池，支持 CRUD/标签/复抓频率/状态流转
-- 幂等可重跑：全部 CREATE TABLE IF NOT EXISTS。
-- charset utf8mb4_unicode_ci，与其它表一致。
-- =================================================================

SET NAMES utf8mb4;

-- -----------------------------------------------------------------
-- 1. sellersprite_request_run：请求中心任务
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sellersprite_request_run (
    run_id VARCHAR(64) PRIMARY KEY COMMENT '任务唯一标识',
    request_type VARCHAR(32) NOT NULL COMMENT 'SHOP_FULL_LOOKUP/ASIN_LOOKUP/CANDIDATE_BATCH/PREMIUM_REFRESH',
    marketplace VARCHAR(16) NOT NULL DEFAULT '' COMMENT '站点（任务级，item 可覆盖；多站点任务为 MIXED）',
    trigger_type VARCHAR(32) NOT NULL DEFAULT 'MANUAL' COMMENT 'CANDIDATE_CONFIRM/WATCHLIST/PREMIUM_REFRESH/MANUAL',
    trigger_ref TEXT NULL COMMENT '来源引用摘要/JSON；批量任务不要依赖长度固定的 VARCHAR',
    fetch_reason VARCHAR(512) NULL COMMENT '抓取原因',
    batch_code VARCHAR(16) NULL COMMENT 'ISO 周批次',
    batch_date VARCHAR(64) NULL COMMENT '入库日期 yyyyMMdd',
    total_count INT NOT NULL DEFAULT 0 COMMENT '子项总数',
    pending_count INT NOT NULL DEFAULT 0 COMMENT '待处理数',
    running_count INT NOT NULL DEFAULT 0 COMMENT '处理中数',
    success_count INT NOT NULL DEFAULT 0 COMMENT '成功数',
    failed_count INT NOT NULL DEFAULT 0 COMMENT '失败数',
    skipped_count INT NOT NULL DEFAULT 0 COMMENT '跳过数（暂停/重复/状态不允许）',
    api_calls INT NOT NULL DEFAULT 0 COMMENT '本任务消耗的卖家精灵使用次数',
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING/RUNNING/PAUSED/STOPPED/SUCCESS/FAILED/PARTIAL_SUCCESS',
    last_error_message VARCHAR(512) NULL COMMENT '任务级错误',
    operator VARCHAR(64) NULL COMMENT '操作人',
    started_at DATETIME NULL COMMENT '任务开始时间',
    finished_at DATETIME NULL COMMENT '任务结束时间',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    KEY idx_req_run_type (request_type, status),
    KEY idx_req_run_trigger (trigger_type, status),
    KEY idx_req_run_batch (batch_code),
    KEY idx_req_run_status (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='卖家精灵请求中心：批量任务实况';

-- -----------------------------------------------------------------
-- 2. sellersprite_request_item：请求中心任务子项
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sellersprite_request_item (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键',
    run_id VARCHAR(64) NOT NULL COMMENT '关联 sellersprite_request_run.run_id',
    seq INT NOT NULL COMMENT '任务内序号（0 起）',
    marketplace VARCHAR(16) NOT NULL COMMENT '子项站点',
    seller_name VARCHAR(255) NOT NULL COMMENT '店铺名',
    trigger_id BIGINT NULL COMMENT '来源记录 ID（候选池/精品池 id）',
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING/RUNNING/SUCCESS/PARTIAL_SUCCESS/FAILED/SKIPPED',
    shop_fetch_run_id VARCHAR(64) NULL COMMENT '抓取成功后关联的 shop_fetch_run.run_id',
    total INT NULL COMMENT '卖家精灵返回总数',
    fetched_count INT NULL COMMENT '实际拉取数',
    written_count INT NULL COMMENT '写入/更新数',
    failed_count INT NULL COMMENT '解析或写入失败数',
    api_calls INT NULL COMMENT '本子项消耗使用次数',
    error_message VARCHAR(512) NULL COMMENT '失败原因',
    started_at DATETIME NULL COMMENT '开始时间',
    finished_at DATETIME NULL COMMENT '结束时间',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    UNIQUE KEY uk_req_item (run_id, seq),
    KEY idx_req_item_run_status (run_id, status),
    KEY idx_req_item_seller (marketplace, seller_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='卖家精灵请求中心：任务子项';

-- -----------------------------------------------------------------
-- 3. shop_premium_pool：精品店铺池
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shop_premium_pool (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键',
    marketplace VARCHAR(16) NOT NULL COMMENT '站点',
    seller_name VARCHAR(255) NOT NULL COMMENT '店铺名',
    seller_id VARCHAR(128) NULL COMMENT '卖家 ID',
    source_type VARCHAR(32) NOT NULL DEFAULT 'CANDIDATE_PROMOTE' COMMENT '入池来源 CANDIDATE_PROMOTE/MANUAL/WATCHLIST_PROMOTE',
    source_id BIGINT NULL COMMENT '来源记录 ID（候选池 id 等）',
    reason VARCHAR(512) NULL COMMENT '入池原因，前端必须展示',
    tags_json JSON NULL COMMENT '标签数组，如 ["精铺","上新快"]',
    quality_level VARCHAR(16) NOT NULL DEFAULT 'MID' COMMENT 'HIGH/MID/LOW',
    refresh_frequency VARCHAR(16) NOT NULL DEFAULT 'MONTHLY' COMMENT 'WEEKLY/MONTHLY/MANUAL',
    last_fetch_run_id VARCHAR(64) NULL COMMENT '最近成功抓取 run_id',
    last_fetch_date VARCHAR(64) NULL COMMENT '最近抓取日期 yyyyMMdd',
    next_fetch_date VARCHAR(64) NULL COMMENT '下次建议抓取日期 yyyyMMdd',
    refresh_status VARCHAR(32) NOT NULL DEFAULT 'IDLE' COMMENT 'IDLE/RUNNING/FAILED（复抓任务状态，与 status 区分）',
    last_error_message VARCHAR(512) NULL COMMENT '最近复抓失败原因',
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' COMMENT 'ACTIVE/PAUSED/REMOVED（是否属于精品池）',
    note VARCHAR(512) NULL COMMENT '备注',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    UNIQUE KEY uk_premium_shop (marketplace, seller_name),
    KEY idx_premium_status (marketplace, status),
    KEY idx_premium_refresh (refresh_status, next_fetch_date),
    KEY idx_premium_quality (quality_level, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='精品店铺池：长期复用、周期复抓';
