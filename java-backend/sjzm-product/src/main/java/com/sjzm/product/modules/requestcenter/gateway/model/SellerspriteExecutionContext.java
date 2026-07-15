package com.sjzm.product.modules.requestcenter.gateway.model;

/**
 * 一次卖家精灵调用的业务关联和脱敏审计范围。
 * 所有字段均可为空，以兼容迁移期的旧入口；新请求中心任务必须传 runId/itemId。
 */
public record SellerspriteExecutionContext(
        String runId,
        Long itemId,
        String requestType,
        String requestScope,
        Integer attemptNo
) {
    public static SellerspriteExecutionContext legacy(String requestType, String requestScope) {
        return new SellerspriteExecutionContext(null, null, requestType, requestScope, 1);
    }
}
