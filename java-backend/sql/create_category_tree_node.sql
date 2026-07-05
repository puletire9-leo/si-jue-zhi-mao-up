-- 新品榜类目树（邻接表物化）
-- 数据来源：competitor_products WHERE source='新品榜'
-- 由 CategoryTreeService.refresh(marketplace) 从竞品表重建；每行一个树节点。
-- product_count = 该节点子树下去重 ASIN 数（父节点 = 子孙 ASIN 并集，不虚高）。
-- 见 java-backend/sjzm-product/.../modules/categorytree

CREATE TABLE IF NOT EXISTS category_tree_node (
    id                BIGINT       NOT NULL PRIMARY KEY COMMENT '主键(雪花ID)',
    marketplace       VARCHAR(10)  NOT NULL COMMENT '站点 UK/DE/US',
    level             INT          NOT NULL COMMENT '层级 1=大类',
    label             VARCHAR(200) NOT NULL COMMENT '本级类目名',
    label_path        VARCHAR(500) NOT NULL COMMENT '从根到本节点的完整标签路径(:分隔)',
    parent_label_path VARCHAR(500) DEFAULT NULL COMMENT '父节点 label_path，顶层为 NULL',
    node_id           VARCHAR(32)  DEFAULT NULL COMMENT '亚马逊节点ID(对应该级)',
    bsr_id            VARCHAR(32)  DEFAULT NULL COMMENT '榜单大类码，仅 level=1 有值',
    product_count     INT          NOT NULL DEFAULT 0 COMMENT '去重ASIN数(含子孙)',
    direct_count      INT          NOT NULL DEFAULT 0 COMMENT '仅本级直接ASIN数',
    batch_date        VARCHAR(20)  DEFAULT NULL COMMENT '刷新批次(生成时间戳)',
    created_at        DATETIME     DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at        DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    UNIQUE KEY uk_market_path (marketplace, label_path),
    KEY idx_market_level (marketplace, level),
    KEY idx_market_parent (marketplace, parent_label_path)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='新品榜类目树(邻接表)';
