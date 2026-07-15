package com.sjzm.product.modules.requestcenter.gateway.model;

import com.sjzm.product.dto.CompetitorLookupRequest;

import java.util.Objects;

/** 类型化的卖家精灵竞品查询请求。 */
public record SellerspriteExecutionRequest(
        CompetitorLookupRequest competitorLookupRequest,
        SellerspriteExecutionContext context
) {
    public SellerspriteExecutionRequest {
        Objects.requireNonNull(competitorLookupRequest, "competitorLookupRequest 不能为空");
        Objects.requireNonNull(context, "context 不能为空");
    }
}
