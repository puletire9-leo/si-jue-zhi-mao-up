package com.sjzm.product.modules.shopcollection.dto;

import lombok.Data;

/**
 * 三维聚合原子单元：销量层 × 时间层 × 类目。
 * 注意/倾向层不在 SQL 计算，由 {@code ShopProfileLabelRule} 按 categoryKey/nodeLabelPath 在 Java 侧补。
 * 三张矩阵（销量×时间 / 销量×注意 / 时间×注意）都由这批 cell 聚合得到，口径唯一。
 */
@Data
public class ShopTierAgeCategoryCell {
    private String marketplace;
    private String sellerName;
    private String salesTier;
    private String ageBucket;
    private String categoryKey;
    private String nodeLabelPath;
    private Long productCount;
    private Long unitsSum;
    private Long m01HitCount;
    private Double avgListingDays;

    /** 由 ShopProfileLabelRule 在 Java 侧补：GOOD_TENDENCY/NEUTRAL/ATTENTION_REVIEW/ATTENTION_STRONG/UNKNOWN。 */
    private String attentionLevel;
}
