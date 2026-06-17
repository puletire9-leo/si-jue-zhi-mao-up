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

    /** 按入库周次过滤（ISO 周，如 2026-W19），实时由 created_at 计算，不依赖 week_tag 列 */
    private String createdWeek;

    /**
     * 灵活合格规则（最多 5 条，规则间 OR：满足任一即合格）。
     * 取代写死的 MODE1/MODE2 硬分类，由用户在查询期自由配置。
     * 每条规则含若干条件（AND 组合），每个条件 = 字段 + 运算符 + 阈值。
     * 例：[{conditions:[{field:"listingDays",op:"le",value:30},{field:"units",op:"gt",value:30}]}]
     *   = 上架≤30天 且 销量>30 合格。
     */
    private List<QualifyRule> qualifyRules;

    /** 单条合格规则：内部条件 AND 组合（仅有值的条件生效）。 */
    @Data
    public static class QualifyRule {
        private List<RuleCondition> conditions;
    }

    /** 规则条件：字段 + 运算符 + 阈值。字段/运算符在 Service 与 Mapper 层做白名单校验。 */
    @Data
    public static class RuleCondition {
        /** 字段：listingDays(上架天数) | weightG(重量g) | units(销量) | bsr(排名) */
        private String field;
        /** 运算符：lt(&lt;) | le(≤) | eq(=) | ge(≥) | gt(&gt;) */
        private String op;
        /** 阈值 */
        private BigDecimal value;
    }
}
