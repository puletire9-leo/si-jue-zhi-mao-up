package com.sjzm.product.modules.requestcenter.model;

/** 卖家精灵执行网关输出的稳定错误分类。 */
public enum SellerspriteExecutionErrorCode {
    CONNECT_TIMEOUT,
    READ_TIMEOUT,
    NETWORK,
    CIRCUIT_OPEN,
    RATE_LIMIT,
    AUTH,
    INVALID_REQUEST,
    UPSTREAM_ERROR,
    PARSE_ERROR,
    INTERNAL_ERROR
}
