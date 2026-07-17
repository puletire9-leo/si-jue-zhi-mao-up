package com.sjzm.product.modules.lingxing.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

/**
 * 领星 ASIN 基准主表（lingxing_asin_baseline）。
 *
 * <p>模型一 / 模型二 / 所有分析脚本的起点。锁定 6945 个团队 ASIN，
 * 每周由 weekly_asin_sync.py 从领星 API 自动发现并更新。</p>
 *
 * <p>字段口径见 产品数据/领星模型/领星中心.md。</p>
 */
@Data
@TableName("lingxing_asin_baseline")
public class LingxingAsinBaseline {

    /** ASIN（唯一主键） */
    @TableId
    private String asin;

    /** 基础 SKU（首次出现时的 local_sku） */
    private String baseSku;

    /** 基础店铺（首次出现时的 seller_name） */
    private String baseStore;

    /** 开发人（团队 8 人之一） */
    private String developer;

    /** 领星标签串（逗号分隔，含 6 团队标签之一） */
    private String listingTags;

    /** 领星商品创建时间（product_create_time） */
    private String createTime;

    /** FBA 库存首次出现月份（月份格式 YYYY-MM） */
    private String fbaInventoryFirstMonth;

    /** 库存首次店铺 */
    private String inventoryFirstStore;

    /** 库存首次国家 */
    private String inventoryFirstCountry;

    /** 库存首次 SKU */
    private String inventoryFirstSku;

    /** 库存首次数量 */
    private java.math.BigDecimal inventoryFirstQty;

    /** FBA 可售首次月份 */
    private String fbaAvailableFirstMonth;

    /** 可售首次店铺 */
    private String availableFirstStore;

    /** 可售首次国家 */
    private String availableFirstCountry;

    /** 可售首次 SKU */
    private String availableFirstSku;

    /** 可售首次数量 */
    private java.math.BigDecimal availableFirstQty;

    /** FBA 观察状态 */
    private String fbaObservationStatus;

    /** 数据覆盖截止月 */
    private String dataCoverageEnd;

    /** 商品创建时间（备份） */
    private String productCreateTime;

    /** 商品创建来源 */
    private String productCreateSource;

    /** FBA 可售首次月份最终值（含兜底） */
    private String fbaAvailableFirstMonthFinal;

    /** 可售首次判定依据（周同步首次观察到FBA可售 / 商品信息创建时间兜底 / 未观察到FBA可售） */
    private String fbaAvailableFirstBasis;

    /** 模型起算月份 */
    private String modelStartMonth;

    /** 起算依据 */
    private String modelStartBasis;

    /** 时间精度（month/day） */
    private String timePrecision;

    /** 数据截止月 */
    private String dataCutoffMonth;

    /** 分析状态（周同步自动新增 等） */
    private String analysisStatus;

    /** 基准版本号 */
    private String baselineVersion;
}
