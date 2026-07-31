-- =================================================================
-- 领星 Listing FBA 预估费中间表（getPrices 接口落库）
--
-- 数据来源：领星 /listing/listing/open/api/listing/getPrices（按 sid+msku 拉 fba_fee）
-- 用途：对比表 rebuild 时 JOIN 取亚马逊实际/预估 FBA 配送费。
-- 唯一键 sid+msku（同 listing 唯一键口径）。
-- =================================================================

CREATE TABLE IF NOT EXISTS `lingxing_listing_fba_fee` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `sid` BIGINT NOT NULL COMMENT '店铺 id',
    `msku` VARCHAR(255) NOT NULL COMMENT 'MSKU (seller_sku)',
    `fba_fee` DECIMAL(18,4) DEFAULT NULL COMMENT 'FBA预估费-API',
    `fba_fee_report` DECIMAL(18,4) DEFAULT NULL COMMENT 'FBA预估费-报表',
    `fee_currency` VARCHAR(16) DEFAULT NULL COMMENT 'FBA预估费币种',
    `synced_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_sid_msku` (`sid`, `msku`),
    KEY `idx_msku` (`msku`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='领星Listing FBA预估费(getPrices)';
