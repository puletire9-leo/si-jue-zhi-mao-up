-- =================================================================
-- 领星开发人预测 FBA 配送费表（理实产品开发表 CSV 导入目标）
--
-- 数据来源：产品数据/产品表/理实产品开发表/理实产品开发表_{英国,德国}.csv
--   （开发人在对接表 Excel 里手工计算的 FBA 配送费/利润率，领星本地产品表没有）
-- 导入脚本：scripts/lingxing_daily/import_developer_fba.py（同 SKU 跨月多条，去重取最新）
-- SKU = 本地产品 local_sku（数字），与 lingxing_listing.raw_json.local_sku 对齐
--
-- charset/collation 与其它 lingxing_* 一致（utf8mb4_unicode_ci）。
-- =================================================================

CREATE TABLE IF NOT EXISTS `lingxing_developer_fba` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `sku` VARCHAR(128) NOT NULL COMMENT '本地产品 SKU（local_sku 数字）',
    `country` VARCHAR(8) NOT NULL COMMENT '国家 UK/DE',
    `dev_remark` VARCHAR(255) DEFAULT NULL COMMENT '开发备注（拓品等）',
    `dev_fba_fee` DECIMAL(18,4) DEFAULT NULL COMMENT '开发人计算的 FBA 配送费($)',
    `dev_profit_rate` DECIMAL(18,6) DEFAULT NULL COMMENT '开发人计算的利润率(%)',
    `source_file` VARCHAR(255) DEFAULT NULL COMMENT '来源文件（追溯用）',
    `imported_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_sku_country` (`sku`, `country`),
    KEY `idx_sku` (`sku`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='领星开发人预测FBA配送费（理实产品开发表CSV导入）';
