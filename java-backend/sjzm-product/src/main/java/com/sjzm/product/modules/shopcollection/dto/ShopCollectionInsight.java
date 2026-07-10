package com.sjzm.product.modules.shopcollection.dto;

import com.sjzm.product.modules.analysisbaseline.shopprofile.dto.ShopProfileSummary;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class ShopCollectionInsight {
    private ShopSnapshot snapshot;
    private ShopProfileSummary profile;
    private String methodId;
    private Long m01HitCount;
    private Double m01HitRatio;
    private Long earliestAvailableDate;
    private String earliestAvailableDateText;
    private Integer maxListingDays;
    private Double avgListingDays;
    private Double avgUnits;
    private Long new30Count;
    private Long new90Count;
    private Long new180Count;
    private Long old180Count;
    private Long unknownListingDaysCount;
    private List<ShopTierInsight> tierStats = new ArrayList<>();
    private List<ShopCategoryInsight> categoryStats = new ArrayList<>();

    /** 互斥时间桶统计（模型分层，非累计窗口）。 */
    private List<ShopAgeBucketStat> ageBucketStats = new ArrayList<>();

    /** 销量层 × 时间层矩阵。 */
    private ShopMatrix salesAgeMatrix;

    /** 销量层 × 注意/倾向层矩阵。 */
    private ShopMatrix salesAttentionMatrix;

    /** 时间层 × 注意/倾向层矩阵。 */
    private ShopMatrix ageAttentionMatrix;

    /** 好品倾向 top 类目（按商品数）。 */
    private List<String> topGoodTendencyCategories = new ArrayList<>();

    /** 强注意/需复核 top 类目（按商品数）。 */
    private List<String> topAttentionCategories = new ArrayList<>();

    /** 三维店铺类型（解释标签，非最终评级）。 */
    private String shopProfile3dType;

    /** 三维店铺类型中文解释。 */
    private String shopProfile3dExplanation;

    /**
     * Preferred field for frontend display: attention/tendency label aggregation, not final rejection.
     */
    private List<ShopCategoryRiskInsight> categoryLabelStats = new ArrayList<>();

    /**
     * Compatibility alias for the first frontend draft.
     */
    private List<ShopCategoryRiskInsight> riskStats = new ArrayList<>();
}
