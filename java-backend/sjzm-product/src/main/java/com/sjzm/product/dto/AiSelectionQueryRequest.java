package com.sjzm.product.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

/**
 * AI 选品查询请求 DTO。
 * 镜像 CompetitorQueryRequest 全套筛选字段，额外支持 batchIds 批次过滤。
 */
@Data
public class AiSelectionQueryRequest {

    private String marketplace;
    private List<String> asin;
    private List<String> batchIds;
    private String batchLabel;
    /** 非标载体多选筛选（对应 ai_selection.carrier / nonstandard_carrier.carrier_key） */
    private List<String> carriers;
    /** 方法卡快筛：M01 / M03（作用在 ai_selection 表，套用同口径门槛） */
    private String methodId;
    private String title;
    private String sellerName;
    private String brand;
    private String category;
    private String sortBy;
    private String sortOrder;
    private Integer page = 1;
    private Integer size = 60;

    // 价格区间
    private BigDecimal priceMin;
    private BigDecimal priceMax;

    // 销量区间
    private Integer unitsMin;
    private Integer unitsMax;

    // BSR 上限
    private Integer bsrMax;

    // 上架天数区间
    private Integer listingDaysMin;
    private Integer listingDaysMax;

    // 重量上限
    private BigDecimal weightMax;

    // 变体数上限
    private Integer maxVariantCount;

    // 配送方式多选
    private List<String> fulfillment;

    // 类目树筛选
    private String bsrId;
    private Long nodeId;
}
