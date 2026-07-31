-- =================================================================
-- 领星 FBA 配送费对比表（开发人预测 vs 亚马逊实际/预估）
--
-- 每合格 ASIN×MSKU 一行。资格 = 统一表目标 ASIN ∩ 近3月(5/6/7)合计销量>30 ∩ 近3月合计正利润。
-- 亚马逊实际FBA费 ← 领星 getPrices 接口 fba_fee；开发人预测 ← lingxing_developer_fba。
-- 桥梁：lingxing_listing (sid+msku+asin+local_sku)。
-- 重算：LingxingFbaFeeCompareService.rebuild()（truncate 重建）。
--
-- charset/collation 与其它 lingxing_* 一致（utf8mb4_unicode_ci）。
-- =================================================================

CREATE TABLE IF NOT EXISTS `lingxing_fba_fee_compare` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `asin` VARCHAR(32) NOT NULL,
    `msku` VARCHAR(255) DEFAULT NULL COMMENT 'seller_sku',
    `sid` BIGINT DEFAULT NULL COMMENT '店铺 id',
    `local_sku` VARCHAR(128) DEFAULT NULL COMMENT '本地 SKU（关联开发表）',
    `developer` VARCHAR(64) DEFAULT NULL COMMENT '开发人（统一表）',
    `country` VARCHAR(8) DEFAULT NULL COMMENT 'UK/DE',
    -- 亚马逊实际/预估 FBA 配送费（getPrices）
    `amazon_fba_fee` DECIMAL(18,4) DEFAULT NULL COMMENT '亚马逊FBA预估费-API',
    `amazon_fba_fee_report` DECIMAL(18,4) DEFAULT NULL COMMENT '亚马逊FBA预估费-报表',
    `fee_currency` VARCHAR(16) DEFAULT NULL COMMENT 'FBA费币种',
    -- 开发人预测 FBA 配送费
    `dev_fba_fee` DECIMAL(18,4) DEFAULT NULL COMMENT '开发人预测FBA配送费',
    -- 差异
    `diff` DECIMAL(18,4) DEFAULT NULL COMMENT '实际-预测（amazon_fba_fee - dev_fba_fee）',
    `diff_rate` DECIMAL(18,6) DEFAULT NULL COMMENT '差异率 = diff / dev_fba_fee',
    -- 资格佐证
    `recent3m_volume` BIGINT DEFAULT NULL COMMENT '近3月合计销量',
    `recent3m_profit` DECIMAL(18,4) DEFAULT NULL COMMENT '近3月合计利润',
    `synced_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_asin_msku` (`asin`, `msku`),
    KEY `idx_developer` (`developer`),
    KEY `idx_asin` (`asin`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='FBA配送费对比：开发人预测vs亚马逊实际';
