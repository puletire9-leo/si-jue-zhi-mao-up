package com.sjzm.product.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * AI 选品商品概览（投递后返回给调用方/前端，不做全量列表）。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiSelectionProductBrief {
    private String asin;
    private String title;
    private String imageUrl;
    private String marketplace;
    private String sourceRef;
    private String batchId;
}
