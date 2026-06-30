-- =================================================================
-- 八爪鱼以图识图结果表
-- 2026-06-30 · 以图识图数据管道：ASIN 图片 → 站点视觉搜索 URL → 八爪鱼爬亚马逊以图搜图 → 命中相似品
-- =================================================================
-- 语义：
--   每行 = 某 source_asin 在某站点的一条命中相似品。
--   按 source_asin 缓存：库里已有该 asin 结果则直接返回，前端「重新识图」
--   走 forceRefresh，先删该 asin 旧结果再写新结果。
--   本期只做英国（marketplace='UK', stylesnap）。
-- charset/collation 与 competitor_products 一致（utf8mb4_unicode_ci）。
-- =================================================================

CREATE TABLE IF NOT EXISTS `bazhuayu_image_search_result` (
    `id`               BIGINT        NOT NULL                  COMMENT '主键（雪花算法）',
    `source_asin`      VARCHAR(20)   NOT NULL                  COMMENT '发起识图的源 ASIN',
    `marketplace`      VARCHAR(10)   NOT NULL                  COMMENT '站点 UK/DE/US（本期固定 UK）',
    `source_image_url` VARCHAR(1000) DEFAULT NULL              COMMENT '源图 URL',
    `search_url`       VARCHAR(1500) DEFAULT NULL              COMMENT '生成的视觉搜索 URL（UK=stylesnap）',
    `result_asin`      VARCHAR(20)   DEFAULT NULL              COMMENT '命中的相似品 ASIN',
    `result_title`     VARCHAR(1000) DEFAULT NULL              COMMENT '命中品标题',
    `result_image`     VARCHAR(1000) DEFAULT NULL              COMMENT '命中品图片 URL',
    `result_price`     VARCHAR(50)   DEFAULT NULL              COMMENT '命中品价格原始文本',
    `raw_json`         JSON          DEFAULT NULL              COMMENT '八爪鱼原始行（留痕，便于列映射核对）',
    `lot_no`           VARCHAR(40)   DEFAULT NULL              COMMENT '八爪鱼云采集批次号',
    `scraped_at`       DATETIME      DEFAULT NULL              COMMENT '采集时间',
    `created_at`       DATETIME      DEFAULT CURRENT_TIMESTAMP COMMENT '入库时间',

    PRIMARY KEY (`id`),
    INDEX `idx_source_asin` (`source_asin`, `marketplace`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='八爪鱼以图识图结果（按 source_asin 缓存）';
