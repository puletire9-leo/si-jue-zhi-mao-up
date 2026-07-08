-- =================================================================
-- 店铺候选池 + 店铺抓取运行记录：shop_candidate_pool + shop_fetch_run
-- =================================================================
-- 设计见 docs/店铺品级/店铺候选池与精品店铺池完整实施计划.md 三-1 / 三-2
-- =================================================================
-- 职责边界：
--   shop_candidate_pool —— 方法卡命中 → 批量候选，人工筛选，确认后触发抓取（确认前不消耗卖家精灵使用次数）
--   shop_fetch_run       —— 每次卖家精灵店铺名查询的运行记录（使用次数消耗/成功失败）
--   shop_watchlist       —— 候选池确认后 / 人工 / 基线 进入的正式观察池
-- 幂等可重跑：全部 CREATE TABLE IF NOT EXISTS。
-- charset utf8mb4_unicode_ci，与其它表一致。
-- =================================================================

SET NAMES utf8mb4;

-- -----------------------------------------------------------------
-- 1. shop_candidate_pool：店铺候选池
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shop_candidate_pool (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键',
    marketplace VARCHAR(16) NOT NULL COMMENT '站点 UK/DE/US',
    seller_name VARCHAR(255) NOT NULL COMMENT '店铺名',
    seller_id VARCHAR(128) NULL COMMENT '店铺ID，可为空',
    source_type VARCHAR(32) NOT NULL DEFAULT 'METHOD_CARD' COMMENT 'METHOD_CARD/BASELINE/MANUAL/CATEGORY/OWN_GOOD_SIMILAR',
    source_code VARCHAR(64) NOT NULL DEFAULT '' COMMENT 'M01/M03/ZHENG_UK_DE 等，进唯一键，禁止 NULL',
    batch_code VARCHAR(16) NOT NULL DEFAULT '' COMMENT 'ISO 周批次 yyyy-Www，进唯一键，禁止 NULL',
    batch_date VARCHAR(64) NULL COMMENT '数据批次日期 yyyyMMdd',
    reason VARCHAR(512) NULL COMMENT '入池原因，前端必须展示',
    hit_count INT NULL COMMENT '方法卡命中商品数（父体去重后）',
    top_category VARCHAR(255) NULL COMMENT '主命中类目',
    sales_tier_summary_json JSON NULL COMMENT '命中商品 A/B/C/D 摘要',
    sample_products_json JSON NULL COMMENT '命中商品样例：图片/ASIN/标题/类目，建议 3-6 条',
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING/SELECTED/FETCHING/FETCHED/FETCH_FAILED/IGNORED/PROMOTED',
    watchlist_id BIGINT NULL COMMENT '转入观察池后的 shop_watchlist.id',
    fetch_run_id VARCHAR(64) NULL COMMENT '抓取 run_id（关联 shop_fetch_run.run_id）',
    premium_id BIGINT NULL COMMENT '转入精品池后的 shop_premium_pool.id',
    last_error_message VARCHAR(512) NULL COMMENT '最近一次抓取失败原因',
    last_fetch_at DATETIME NULL COMMENT '最近一次触发抓取时间',
    operator VARCHAR(64) NULL COMMENT '操作人',
    note VARCHAR(512) NULL COMMENT '人工备注',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    UNIQUE KEY uk_candidate_source (marketplace, seller_name, source_type, source_code, batch_code),
    KEY idx_candidate_batch (batch_code, status),
    KEY idx_candidate_status (marketplace, status),
    KEY idx_candidate_seller (marketplace, seller_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='店铺候选池：承接方法卡命中→人工筛选→确认抓取';

-- -----------------------------------------------------------------
-- 2. shop_fetch_run：店铺抓取运行记录
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shop_fetch_run (
    run_id VARCHAR(64) PRIMARY KEY COMMENT '抓取批次唯一标识',
    marketplace VARCHAR(16) NOT NULL COMMENT '站点',
    seller_name VARCHAR(255) NOT NULL COMMENT '店铺名',
    trigger_type VARCHAR(32) NOT NULL COMMENT 'CANDIDATE_CONFIRM/WATCHLIST/PREMIUM_REFRESH/MANUAL',
    trigger_id BIGINT NULL COMMENT '来源记录 ID（候选池/观察池/精品池 id）',
    fetch_reason VARCHAR(512) NULL COMMENT '抓取原因',
    batch_code VARCHAR(16) NULL COMMENT 'ISO 周批次',
    batch_date VARCHAR(64) NULL COMMENT '入库日期 yyyyMMdd',
    variation_mode VARCHAR(8) NOT NULL DEFAULT 'Y' COMMENT '固定 Y=不含变体',
    total INT NULL COMMENT '卖家精灵返回总数',
    fetched_count INT NULL COMMENT '实际拉取的商品行数',
    written_count INT NULL COMMENT '成功写入/更新的商品行数',
    failed_count INT NULL COMMENT '解析或写入失败的商品行数',
    api_calls INT NULL COMMENT '消耗的卖家精灵使用次数',
    status VARCHAR(32) NOT NULL DEFAULT 'RUNNING' COMMENT 'RUNNING/SUCCESS/PARTIAL_SUCCESS/FAILED',
    error_message TEXT NULL COMMENT '错误详情',
    started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '开始时间',
    finished_at DATETIME NULL COMMENT '结束时间',
    KEY idx_fetch_run_marketplace (marketplace, seller_name),
    KEY idx_fetch_run_trigger (trigger_type, trigger_id),
    KEY idx_fetch_run_batch (batch_code),
    KEY idx_fetch_run_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='店铺抓取运行记录：追溯每次 API 调用';
