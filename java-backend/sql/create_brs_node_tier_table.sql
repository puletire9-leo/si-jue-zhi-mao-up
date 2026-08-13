-- ============================================================
-- BRS 档位维度表（brs_node_tier）
-- 说明：BRS 榜单独有的「Browse Node 平均销量档位」，与 brs_ranking_raw
--       按 node_id 关联。档位由 8.6 分级产出（BRS平均销量分级明细.csv）。
--       更新档位 = 改本表；榜单详情读时 LEFT JOIN 自动生效，无需重写详情。
-- 关联：brs_ranking_raw.node_id = brs_node_tier.node_id (同 marketplace)
-- ============================================================

CREATE TABLE IF NOT EXISTS brs_node_tier (
    marketplace      VARCHAR(10)  NOT NULL COMMENT '站点 UK/DE/US',
    node_id          BIGINT       NOT NULL COMMENT 'Amazon Browse Node ID',
    bsr_id           VARCHAR(50)  DEFAULT NULL COMMENT 'BSR 大类代码，如 kitchen/toys',
    sales_tier       VARCHAR(40)  DEFAULT NULL COMMENT '档位：A_高销量.../B_中高.../C_有效.../D_低.../E_小样本',
    tier_code        VARCHAR(2)   DEFAULT NULL COMMENT '档位简码 A/B/C/D/E（sales_tier 首字母，便于筛选）',
    suggested_pages  INT          DEFAULT NULL COMMENT '建议爬取页数 30/20/10/5',
    sample_count     INT          DEFAULT NULL COMMENT '分级样本商品数',
    known_sales_count INT         DEFAULT NULL COMMENT '有销量样本数',
    avg_units        DECIMAL(12,2) DEFAULT NULL COMMENT '平均月销量',
    zero_sales_pct   DECIMAL(6,2) DEFAULT NULL COMMENT '零销量占比 %',
    max_units        INT          DEFAULT NULL COMMENT '最大月销量',
    url              VARCHAR(300) DEFAULT NULL COMMENT '方法二 Node 搜索链接',
    updated_at       DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (marketplace, node_id),
    KEY idx_tier_code (marketplace, tier_code),
    KEY idx_bsr_id (marketplace, bsr_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='BRS 榜单 Node 档位维度表';
