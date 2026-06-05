package com.sjzm.product.dto;

import lombok.Data;

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
    private Integer size = 20;

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
}
