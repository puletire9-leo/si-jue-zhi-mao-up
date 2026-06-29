-- =================================================================
-- 八爪鱼每周原始采集数据表
-- 2026-06-29 · 自动化采集流水线：云端每周爬取 → 入库 → 初筛
-- =================================================================
-- 语义：
--   只保留「当前 ISO 周」的数据。每次采集开始前删除非本周行
--   （DELETE FROM bazhuayu_weekly_raw WHERE week_tag <> :currentWeekTag）。
--   同周重跑靠唯一键 uk_mp_asin_week 幂等。
-- charset/collation 与 competitor_products 一致（utf8mb4_unicode_ci），
--   避免清洗层 JOIN 时 collation 混用报错。
-- =================================================================

CREATE TABLE IF NOT EXISTS `bazhuayu_weekly_raw` (
    `id`          BIGINT        NOT NULL                  COMMENT '主键（雪花算法）',
    `marketplace` VARCHAR(10)   NOT NULL                  COMMENT '站点 UK/DE/US',
    `asin`        VARCHAR(20)   NOT NULL                  COMMENT 'ASIN',
    `price`       VARCHAR(50)   DEFAULT NULL              COMMENT '原始价格文本（含币种符号）',
    `reviews`     VARCHAR(50)   DEFAULT NULL              COMMENT '原始评论数文本',
    `title`       VARCHAR(1000) DEFAULT NULL              COMMENT '标题',
    `raw_json`    JSON          DEFAULT NULL              COMMENT '八爪鱼原始行（留痕，便于列映射核对）',
    `week_tag`    VARCHAR(10)   NOT NULL                  COMMENT 'ISO 周标记 如 2026-W19',
    `lot_no`      VARCHAR(40)   DEFAULT NULL              COMMENT '八爪鱼云采集批次号',
    `scraped_at`  DATETIME      DEFAULT CURRENT_TIMESTAMP COMMENT '采集入库时间',

    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_mp_asin_week` (`marketplace`, `asin`, `week_tag`),
    INDEX `idx_week_tag` (`week_tag`),
    INDEX `idx_marketplace` (`marketplace`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='八爪鱼每周原始采集数据（仅留最新周）';
