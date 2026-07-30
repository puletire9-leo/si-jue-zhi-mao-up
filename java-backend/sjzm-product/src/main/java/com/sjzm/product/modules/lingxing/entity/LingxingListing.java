package com.sjzm.product.modules.lingxing.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 领星亚马逊 Listing（/erp/sc/data/mws/listing 落库）。
 *
 * <p>双写：结构化业务列供查询/聚合 + raw_json 整包留底（张总蓝本 §一.1）。</p>
 * <p>幂等唯一键：sid + seller_sku（API 文档明示），反复同步走 saveOrUpdate，只更新不堆积、天然可重跑。</p>
 *
 * <p>JSON 列（seller_category_new / dimension_info / small_rank / global_tags / variant）
 * 用 String 落原始 JSON，不做有损拆字段；MyBatis 默认处理器直存即可。</p>
 */
@Data
@TableName("lingxing_listing")
public class LingxingListing {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    /** 亚马逊定义的 listing id（可能为空） */
    private String listingId;

    /** 店铺 id */
    private Integer sid;

    /** 国家（领星返回中文，如 英国/德国） */
    private String marketplace;

    /** 店铺站点 id */
    private Integer mid;

    /** MSKU */
    private String sellerSku;

    /** FNSKU */
    private String fnsku;

    /** ASIN */
    private String asin;

    /** 父 ASIN */
    private String parentAsin;

    /** 本地产品 SKU */
    private String localSku;

    /** 品名（本地产品） */
    private String localName;

    /** 标题 */
    private String itemName;

    /** 商品缩略图地址 */
    private String smallImageUrl;

    /** 状态：0 停售，1 在售 */
    private Integer status;

    /** 是否删除：0 否，1 是 */
    private Integer isDelete;

    /** 是否配对：1 已配对，2 未配对 */
    private Integer isPair;

    /** 币种 */
    private String currencyCode;

    /** 价格（不含促销/运费/积分） */
    private BigDecimal price;

    /** 总价（含促销/运费/积分） */
    private BigDecimal landedPrice;

    /** 优惠价 */
    private BigDecimal listingPrice;

    /** 运费 */
    private BigDecimal shipping;

    /** 积分（日本站） */
    private String points;

    /** FBM 库存 */
    private Integer quantity;

    /** FBA 可售 */
    private Integer afnFulfillableQuantity;

    /** FBA 不可售 */
    private Integer afnUnsellableQuantity;

    /** 待调仓 */
    private Integer reservedFcTransfers;

    /** 调仓中 */
    private Integer reservedFcProcessing;

    /** 待发货 */
    private Integer reservedCustomerorders;

    /** 在途 */
    private Integer afnInboundShippedQuantity;

    /** 计划入库 */
    private Integer afnInboundWorkingQuantity;

    /** 入库中 */
    private Integer afnInboundReceivingQuantity;

    /** 商品创建时间（解析带时区 PST 等字符串后落 UTC）—— 生命周期模型真正上架日锚点 */
    private LocalDateTime openDate;

    /** 商品创建时间原始显示（带时区） */
    private String openDateDisplay;

    /** All Listing 报表更新时间（零时区） */
    private LocalDateTime listingUpdateDate;

    /** 配对更新时间（北京时间 → UTC 落库） */
    private LocalDateTime pairUpdateTime;

    /** 首单时间 */
    private LocalDate firstOrderTime;

    /** 开售时间 */
    private LocalDate onSaleTime;

    /** 排名 */
    private Long sellerRank;

    /** 亚马逊品牌 */
    private String sellerBrand;

    /** 排名所属类别（旧，JSON 字符串） */
    private String sellerCategory;

    /** 排名所属类别（新，数组，原始 JSON 字符串留底） */
    private String sellerCategoryNew;

    /** 评论条数 */
    private Integer reviewNum;

    /** 星级评分 */
    private BigDecimal lastStar;

    /** 配送方式（FBM/FBA） */
    private String fulfillmentChannelType;

    /** 商品类型：1 非低价商店，2 低价商店 */
    private Integer storeType;

    /** 负责人 uid */
    private String principalUid;

    /** 负责人姓名 */
    private String principalName;

    /** 销量-7天 */
    private Integer totalVolume;

    /** 销量-昨天 */
    private Integer yesterdayVolume;

    /** 销量-14天 */
    private Integer fourteenVolume;

    /** 销量-30天 */
    private Integer thirtyVolume;

    /** 销售额-昨天 */
    private BigDecimal yesterdayAmount;

    /** 销售额-7天 */
    private BigDecimal sevenAmount;

    /** 销售额-14天 */
    private BigDecimal fourteenAmount;

    /** 销售额-30天 */
    private BigDecimal thirtyAmount;

    /** 日均销量-7日 */
    private Integer averageSevenVolume;

    /** 日均销量-14日 */
    private Integer averageFourteenVolume;

    /** 日均销量-30日 */
    private Integer averageThirtyVolume;

    /** 尺寸信息原始 JSON */
    private String dimensionInfo;

    /** 小类排名信息原始 JSON */
    private String smallRank;

    /** 全局标签原始 JSON */
    private String globalTags;

    /** 变体属性原始 JSON */
    private String variant;

    /** 领星原始行整包留底 */
    private String rawJson;

    /** 本地同步入库时间 */
    private LocalDateTime syncedAt;
}