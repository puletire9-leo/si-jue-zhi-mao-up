package com.sjzm.product.modules.lingxing.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 领星本地产品（productList/productInfo 落库）。
 *
 * 双写策略（参照 张总系统蓝本 docs/参考/张总系统可借鉴设计.md §一.1）：
 * 结构化业务列供查询/聚合 + {@link #rawJson} 整包留底，
 * 领星字段演进/未映射全的也不丢数据。
 *
 * 幂等：唯一键 = 领星本地产品 ID（lingxing_id，稳定主键），
 * 同步走「按 lingxing_id 查存在 → 命中回填 id → saveOrUpdate」，反复同步只更新不堆积。
 *
 * 见 java-backend/sql/create_lingxing_local_product.sql
 */
@Data
@TableName("lingxing_local_product")
public class LingxingLocalProduct {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    /** 领星本地产品 ID（data>>id，稳定主键，幂等唯一键） */
    private Long lingxingId;

    /** 本地产品 SKU */
    private String sku;

    /** SKU 识别码 */
    private String skuIdentifier;

    /** 品名 */
    private String productName;

    /** 类别 ID（data>>cid） */
    private Long cid;

    /** 类别名称 */
    private String categoryName;

    /** 品牌 ID（data>>bid） */
    private Long bid;

    /** 品牌名称 */
    private String brandName;

    /** 主图链接 */
    private String picUrl;

    /** SPU 唯一 ID（data>>ps_id） */
    private Long psId;

    /** SPU */
    private String spu;

    /** 采购成本（人民币，data>>cg_price） */
    private BigDecimal cgPrice;

    /** 采购交期（天） */
    private Integer cgDelivery;

    /** 采购运输成本 */
    private BigDecimal cgTransportCosts;

    /** 采购备注 */
    private String purchaseRemark;

    /** 状态：0-停售，1-在售，2-开发中，3-清仓 */
    private Integer status;

    /** 状态文本 */
    private String statusText;

    /** 开启状态：0-停用，1-启用 */
    private Integer openStatus;

    /** 是否组合产品：0-否，1-是 */
    private Integer isCombo;

    /** 开发人员 ID */
    private String productDeveloperUid;

    /** 开发人员名称 */
    private String productDeveloper;

    /** 采购员 ID */
    private String cgOptUid;

    /** 采购员名称 */
    private String cgOptUsername;

    /** 领星创建时间（data>>create_time，秒级时间戳转 datetime） */
    private LocalDateTime lxCreateTime;

    /** 领星更新时间（data>>update_time，秒级时间戳转 datetime） */
    private LocalDateTime lxUpdateTime;

    /** 领星原始行 JSON 整包留底（供列映射核对/后续补字段） */
    private String rawJson;

    /** 本地同步入库时间 */
    private LocalDateTime syncedAt;
}
