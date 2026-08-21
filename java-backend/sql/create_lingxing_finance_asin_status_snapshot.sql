-- 财务日报 ASIN 状态快照（远程 RDS）
-- 用于复刻旧工作簿的状态机：继承上一快照断货 ASIN，再叠加当日新出单。
-- 快照只记录本次日报实际使用的标签、创建时间和人员归属，供结果审计。
-- 后续日报不得继承该表的元数据；财务字段只使用当日日事实。
-- 统一表只提供当日 ASIN 白名单，不得给标签、创建时间、运营或开发字段兜底。
CREATE TABLE IF NOT EXISTS `lingxing_finance_asin_status_snapshot` (
    `snapshot_date`       DATE         NOT NULL COMMENT '状态日期',
    `marketplace`         VARCHAR(8)   NOT NULL DEFAULT 'ALL' COMMENT 'UK/DE；历史快照为ALL',
    `asin`                VARCHAR(20)  NOT NULL COMMENT 'ASIN',
    `out_of_stock`        TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '当日有效断货状态',
    `tag_names`           VARCHAR(1000) DEFAULT NULL COMMENT '当日 listing 标签快照',
    `product_create_date` DATE          DEFAULT NULL COMMENT '商品创建日期快照',
    `principal_names`     VARCHAR(500)  DEFAULT NULL COMMENT '运营负责人快照',
    `developer_names`     VARCHAR(500)  DEFAULT NULL COMMENT '开发人快照',
    `source_type`         VARCHAR(32)   NOT NULL DEFAULT 'DAILY_FACT' COMMENT '来源：LEGACY_WORKBOOK/DAILY_FACT',
    `created_at`          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`snapshot_date`, `marketplace`, `asin`),
    KEY `idx_finance_status_marketplace_date` (`marketplace`, `snapshot_date`, `asin`),
    KEY `idx_finance_status_asin_date` (`asin`, `snapshot_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='财务日报ASIN状态时点快照';
