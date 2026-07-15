package com.sjzm.product.modules.requestcenter.gateway.model;

import com.fasterxml.jackson.databind.JsonNode;

/** 一次卖家精灵调用的成功结果及计费语义。 */
public record SellerspriteExecutionResult(
        JsonNode data,
        boolean requestDispatched,
        boolean usageConfirmed,
        int apiCalls
) {
}
