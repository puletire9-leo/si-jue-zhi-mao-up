package com.sjzm.product.modules.requestcenter.model;

/** 请求中心子项的持久化状态。 */
public enum SellerspriteRequestItemStatus {
    PENDING,
    RUNNING,
    /** 已安排可安全重试，尚未达到失败终态。 */
    WAITING_RETRY,
    SUCCESS,
    PARTIAL_SUCCESS,
    FAILED,
    SKIPPED
}
