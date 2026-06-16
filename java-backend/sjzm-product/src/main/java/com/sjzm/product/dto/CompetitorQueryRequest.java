package com.sjzm.product.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class CompetitorQueryRequest {

    private String marketplace;

    @Deprecated
    private String asins;

    private List<String> asin;

    private String month;
    private String brand;
    private String sellerName;
    private Integer page = 1;
    private Integer size = 60;

    // 筛选字段
    private String source;
    private String filterMode;
    private String title;
    private String grade;
    private String weekTag;
    private Integer isCurrent;

    // 排序
    private String sortBy;
    private String sortOrder;

    // 按父ASIN去重
    private Boolean groupByParent;

    // 变体数上限筛选（0=只要独立品，5=5个变体以下）
    private Integer maxVariantCount;

    // 按一级类目筛选
    private String category;

    // ── 品线模型筛选（新增 P5）──
    /** 价格下限 (£), 必须 >= 0 */
    @DecimalMin("0")
    private BigDecimal priceMin;
    /** 价格上限 (£) */
    @DecimalMin("0")
    private BigDecimal priceMax;
    /** BSR 上限（越小越好）, 必须 >= 1 */
    @Min(1)
    private Integer bsrMax;
    /** 评分下限, 范围 0.0-5.0 */
    @DecimalMin("0.0") @DecimalMax("5.0")
    private BigDecimal ratingMin;
    /** 重量上限 (g), 必须 >= 0 */
    @DecimalMin("0")
    private BigDecimal weightMax;
    /** 多词搜索（逗号分隔，所有词需同时匹配标题） */
    private String keywords;

    private String bsrId;
    private Long nodeId;

    // ---- 入库时间范围筛选 ----
    private String createdAtStart;
    private String createdAtEnd;
}
