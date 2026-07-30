-- =================================================================
-- 领星亚马逊 Listing 表（/erp/sc/data/mws/listing 落库）
-- 2026-07-30 · 领星销售板块 Listing 数据接入
-- =================================================================
-- 接口令牌桶容量 1（必须串行，等同卖家精灵铁律）。
-- 语义：
--   领星「销售 > Listing」的亚马逊商品刊登数据。
--   双写：结构化业务列供查询/聚合 + raw_json 整包留底（张总蓝本 §一.1）。
--   幂等唯一键：sid + seller_sku（API 文档明示）。
--   反复同步走 saveOrUpdate，只更新不堆积、天然可重跑。
--
-- 补强价值（相对现有 lingxing_* 表）：
--   open_date / first_order_time / on_sale_time → 生命周期模型真正上架日锚点
--   seller_rank / small_rank                     → 实时排名（月表只有月度 cate_rank）
--   variant / dimension_info                     → 变体与尺寸（领星侧此前缺失）
--   afn_* / reserved_* 实时 FBA 分段库存         → 把月度库存补成可看实时态
--
-- charset/collation 与其它 lingxing_* 一致（utf8mb4_unicode_ci），避免跨表 JOIN 报错。
-- =================================================================

CREATE TABLE IF NOT EXISTS `lingxing_listing` (
    `id`                        BIGINT        NOT NULL                  COMMENT '主键（雪花算法）',
    `listing_id`                VARCHAR(64)   DEFAULT NULL              COMMENT '亚马逊定义的 listing id（可能为空）',
    `sid`                       INT           NOT NULL                  COMMENT '店铺 id',
    `marketplace`               VARCHAR(32)   DEFAULT NULL              COMMENT '国家（如 英国/美国/德国，领星返回中文）',
    `mid`                       INT           DEFAULT NULL              COMMENT '店铺站点 id',
    `seller_sku`                VARCHAR(255)  NOT NULL                  COMMENT 'MSKU',
    `fnsku`                     VARCHAR(64)   DEFAULT NULL              COMMENT 'FNSKU',
    `asin`                      VARCHAR(32)   DEFAULT NULL              COMMENT 'ASIN',
    `parent_asin`              VARCHAR(32)   DEFAULT NULL              COMMENT '父 ASIN',
    `local_sku`                 VARCHAR(255)  DEFAULT NULL              COMMENT '本地产品 SKU',
    `local_name`               VARCHAR(500)  DEFAULT NULL              COMMENT '品名（本地产品）',
    `item_name`                 VARCHAR(1000) DEFAULT NULL              COMMENT '标题',
    `small_image_url`          VARCHAR(1000) DEFAULT NULL              COMMENT '商品缩略图地址',
    `status`                    TINYINT       DEFAULT NULL              COMMENT '状态：0 停售，1 在售',
    `is_delete`                TINYINT       DEFAULT NULL              COMMENT '是否删除：0 否，1 是',
    `is_pair`                   TINYINT       DEFAULT NULL              COMMENT '是否配对：1 已配对，2 未配对',
    `currency_code`            VARCHAR(16)   DEFAULT NULL              COMMENT '币种',
    `price`                     DECIMAL(18,4) DEFAULT NULL              COMMENT '价格（不含促销/运费/积分）',
    `landed_price`             DECIMAL(18,4) DEFAULT NULL              COMMENT '总价（含促销/运费/积分）',
    `listing_price`           DECIMAL(18,4) DEFAULT NULL              COMMENT '优惠价',
    `shipping`                  DECIMAL(18,4) DEFAULT NULL              COMMENT '运费',
    `points`                    VARCHAR(32)   DEFAULT NULL              COMMENT '积分（日本站）',
    `quantity`                  INT           DEFAULT NULL              COMMENT 'FBM 库存',
    `afn_fulfillable_quantity` INT           DEFAULT NULL              COMMENT 'FBA 可售',
    `afn_unsellable_quantity`  INT           DEFAULT NULL              COMMENT 'FBA 不可售',
    `reserved_fc_transfers`    INT           DEFAULT NULL              COMMENT '待调仓',
    `reserved_fc_processing`  INT           DEFAULT NULL              COMMENT '调仓中',
    `reserved_customerorders`  INT           DEFAULT NULL              COMMENT '待发货',
    `afn_inbound_shipped_quantity`      INT   DEFAULT NULL              COMMENT '在途',
    `afn_inbound_working_quantity`      INT   DEFAULT NULL              COMMENT '计划入库',
    `afn_inbound_receiving_quantity`   INT   DEFAULT NULL              COMMENT '入库中',
    `open_date`                 DATETIME      DEFAULT NULL              COMMENT '商品创建时间（解析带时区的 PST 等字符串后落 UTC）',
    `open_date_display`        VARCHAR(64)   DEFAULT NULL              COMMENT '商品创建时间原始显示（带时区，Y-m-d H:i:s+时区）',
    `listing_update_date`      DATETIME      DEFAULT NULL              COMMENT 'All Listing 报表更新时间（零时区）',
    `pair_update_time`         DATETIME      DEFAULT NULL              COMMENT '配对更新时间（北京时间，转 UTC 落库）',
    `first_order_time`         DATE          DEFAULT NULL              COMMENT '首单时间（Y-m-d）',
    `on_sale_time`             DATE          DEFAULT NULL              COMMENT '开售时间（Y-m-d）',
    `seller_rank`              BIGINT        DEFAULT NULL              COMMENT '排名',
    `seller_brand`             VARCHAR(255)  DEFAULT NULL              COMMENT '亚马逊品牌',
    `seller_category`          VARCHAR(500)  DEFAULT NULL              COMMENT '排名所属类别（旧，JSON 字符串）',
    `seller_category_new`      JSON          DEFAULT NULL              COMMENT '排名所属类别（新，数组）',
    `review_num`               INT           DEFAULT NULL              COMMENT '评论条数',
    `last_star`                DECIMAL(4,2)  DEFAULT NULL              COMMENT '星级评分',
    `fulfillment_channel_type` VARCHAR(32)   DEFAULT NULL              COMMENT '配送方式（FBM/FBA）',
    `store_type`               TINYINT       DEFAULT NULL              COMMENT '商品类型：1 非低价商店，2 低价商店',
    `principal_uid`            VARCHAR(64)   DEFAULT NULL              COMMENT '负责人 uid',
    `principal_name`           VARCHAR(255)  DEFAULT NULL              COMMENT '负责人姓名',
    `total_volume`             INT           DEFAULT NULL              COMMENT '销量-7天',
    `yesterday_volume`        INT           DEFAULT NULL              COMMENT '销量-昨天',
    `fourteen_volume`         INT           DEFAULT NULL              COMMENT '销量-14天',
    `thirty_volume`           INT           DEFAULT NULL              COMMENT '销量-30天',
    `yesterday_amount`        DECIMAL(18,4) DEFAULT NULL              COMMENT '销售额-昨天',
    `seven_amount`            DECIMAL(18,4) DEFAULT NULL              COMMENT '销售额-7天',
    `fourteen_amount`         DECIMAL(18,4) DEFAULT NULL              COMMENT '销售额-14天',
    `thirty_amount`           DECIMAL(18,4) DEFAULT NULL              COMMENT '销售额-30天',
    `average_seven_volume`     INT           DEFAULT NULL              COMMENT '日均销量-7日',
    `average_fourteen_volume`  INT           DEFAULT NULL              COMMENT '日均销量-14日',
    `average_thirty_volume`    INT           DEFAULT NULL              COMMENT '日均销量-30日',
    `dimension_info`           JSON          DEFAULT NULL              COMMENT '尺寸信息（商品+包装，含单位）',
    `small_rank`               JSON          DEFAULT NULL              COMMENT '小类排名信息数组 [{category,rank}]',
    `global_tags`              JSON          DEFAULT NULL              COMMENT '全局标签数组 [{globalTagId,tagName,color}]',
    `variant`                  JSON          DEFAULT NULL              COMMENT '变体属性数组 [{attr_name,attr_value}]',
    `raw_json`                 JSON          DEFAULT NULL              COMMENT '领星原始行整包留底',
    `synced_at`                DATETIME      DEFAULT CURRENT_TIMESTAMP COMMENT '本地同步入库时间',

    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_sid_seller_sku` (`sid`, `seller_sku`),
    INDEX `idx_asin` (`asin`),
    INDEX `idx_sid` (`sid`),
    INDEX `idx_status` (`status`),
    INDEX `idx_open_date` (`open_date`),
    INDEX `idx_lx_update` (`listing_update_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='领星亚马逊 Listing（mws/listing 落库，双写，唯一键 sid+seller_sku）';