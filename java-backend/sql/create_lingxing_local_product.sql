-- =================================================================
-- 领星本地产品表（productList/productInfo 落库）
-- 2026-07-03 · 领星数据对接：手动触发拉取本地产品 → 双写落库
-- =================================================================
-- 语义：
--   领星「产品 > 产品管理」的本地产品主数据。
--   双写：结构化业务列供查询/聚合 + raw_json 整包留底（张总蓝本 §一.1）。
--   幂等：唯一键 uk_lingxing_id（领星本地产品 ID，稳定主键），
--         反复同步走 saveOrUpdate，只更新不堆积、天然可重跑。
-- charset/collation 与 competitor_products / bazhuayu_weekly_raw 一致
--   （utf8mb4_unicode_ci），避免跨表 JOIN collation 混用报错。
-- =================================================================

CREATE TABLE IF NOT EXISTS `lingxing_local_product` (
    `id`                   BIGINT        NOT NULL                  COMMENT '主键（雪花算法）',
    `lingxing_id`          BIGINT        NOT NULL                  COMMENT '领星本地产品 ID（幂等唯一键）',
    `sku`                  VARCHAR(128)  DEFAULT NULL              COMMENT '本地产品 SKU',
    `sku_identifier`       VARCHAR(128)  DEFAULT NULL              COMMENT 'SKU 识别码',
    `product_name`         VARCHAR(500)  DEFAULT NULL              COMMENT '品名',
    `cid`                  BIGINT        DEFAULT NULL              COMMENT '类别 ID',
    `category_name`        VARCHAR(255)  DEFAULT NULL              COMMENT '类别名称',
    `bid`                  BIGINT        DEFAULT NULL              COMMENT '品牌 ID',
    `brand_name`           VARCHAR(255)  DEFAULT NULL              COMMENT '品牌名称',
    `pic_url`              VARCHAR(1000) DEFAULT NULL              COMMENT '主图链接',
    `ps_id`                BIGINT        DEFAULT NULL              COMMENT 'SPU 唯一 ID',
    `spu`                  VARCHAR(128)  DEFAULT NULL              COMMENT 'SPU',
    `cg_price`             DECIMAL(18,4) DEFAULT NULL              COMMENT '采购成本（人民币）',
    `cg_delivery`          INT           DEFAULT NULL              COMMENT '采购交期（天）',
    `cg_transport_costs`   DECIMAL(18,4) DEFAULT NULL              COMMENT '采购运输成本',
    `purchase_remark`      VARCHAR(1000) DEFAULT NULL              COMMENT '采购备注',
    `status`               TINYINT       DEFAULT NULL              COMMENT '状态：0-停售 1-在售 2-开发中 3-清仓',
    `status_text`          VARCHAR(50)   DEFAULT NULL              COMMENT '状态文本',
    `open_status`          TINYINT       DEFAULT NULL              COMMENT '开启状态：0-停用 1-启用',
    `is_combo`             TINYINT       DEFAULT NULL              COMMENT '是否组合产品：0-否 1-是',
    `product_developer_uid` VARCHAR(64)  DEFAULT NULL              COMMENT '开发人员 ID',
    `product_developer`    VARCHAR(255)  DEFAULT NULL              COMMENT '开发人员名称',
    `cg_opt_uid`           VARCHAR(64)   DEFAULT NULL              COMMENT '采购员 ID',
    `cg_opt_username`      VARCHAR(255)  DEFAULT NULL              COMMENT '采购员名称',
    `lx_create_time`       DATETIME      DEFAULT NULL              COMMENT '领星创建时间',
    `lx_update_time`       DATETIME      DEFAULT NULL              COMMENT '领星更新时间',
    `raw_json`             JSON          DEFAULT NULL              COMMENT '领星原始行整包留底',
    `synced_at`            DATETIME      DEFAULT CURRENT_TIMESTAMP COMMENT '本地同步入库时间',

    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_lingxing_id` (`lingxing_id`),
    INDEX `idx_sku` (`sku`),
    INDEX `idx_status` (`status`),
    INDEX `idx_lx_update_time` (`lx_update_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='领星本地产品（productList/productInfo 落库，双写）';
