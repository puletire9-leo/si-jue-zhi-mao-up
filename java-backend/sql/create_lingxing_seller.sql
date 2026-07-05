-- =================================================================
-- 领星亚马逊店铺表（seller/lists 落库）
-- 2026-07-03 · 领星数据对接：店铺维度（sid 来源，产品表现/利润统计依赖）
-- =================================================================
-- 语义：
--   领星「查询亚马逊店铺列表」（GET /erp/sc/data/seller/lists）一次性返回
--   企业全部已授权到领星 ERP 的亚马逊 SC 店铺。sid 是产品表现/ASIN 360/
--   利润统计等开放接口的必填/关键入参，本表是这些同步的店铺维度来源。
--   双写：结构化业务列 + raw_json 整包留底（张总蓝本 §一.1）。
--   幂等：唯一键 uk_sid（领星店铺唯一标识），saveOrUpdate 可重跑。
-- charset/collation 与其它领星表一致（utf8mb4_unicode_ci）。
-- =================================================================

CREATE TABLE IF NOT EXISTS `lingxing_seller` (
    `id`                  BIGINT        NOT NULL                  COMMENT '主键（雪花算法）',
    `sid`                 BIGINT        NOT NULL                  COMMENT '领星店铺 ID（幂等唯一键）',
    `mid`                 BIGINT        DEFAULT NULL              COMMENT '站点 ID',
    `name`                VARCHAR(255)  DEFAULT NULL              COMMENT '店铺名',
    `seller_id`           VARCHAR(64)   DEFAULT NULL              COMMENT '亚马逊店铺 ID',
    `account_name`        VARCHAR(255)  DEFAULT NULL              COMMENT '店铺账户名称',
    `seller_account_id`   BIGINT        DEFAULT NULL              COMMENT '店铺账号 ID',
    `region`              VARCHAR(32)   DEFAULT NULL              COMMENT '站点简称（如 NA 指北美）',
    `country`             VARCHAR(64)   DEFAULT NULL              COMMENT '商城所在国家名称',
    `has_ads_setting`     TINYINT       DEFAULT NULL              COMMENT '是否授权广告：0-否 1-是',
    `marketplace_id`      VARCHAR(64)   DEFAULT NULL              COMMENT '市场 ID',
    `status`              TINYINT       DEFAULT NULL              COMMENT '店铺状态：0-停止同步 1-正常 2-授权异常 3-欠费停服',
    `raw_json`            JSON          DEFAULT NULL              COMMENT '领星原始行整包留底',
    `synced_at`           DATETIME      DEFAULT CURRENT_TIMESTAMP COMMENT '本地同步入库时间',

    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_sid` (`sid`),
    INDEX `idx_status` (`status`),
    INDEX `idx_region` (`region`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='领星亚马逊店铺（seller/lists 落库，sid 来源）';
