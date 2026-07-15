package com.sjzm.product.modules.requestcenter.model;

/** 请求中心运行任务的持久化状态。 */
public enum SellerspriteRequestRunStatus {
    PENDING,
    RUNNING,
    PAUSED,
    /** 外部依赖或全局门禁不可用，等待系统恢复或人工恢复。 */
    PAUSED_SYSTEM,
    STOPPED,
    SUCCESS,
    PARTIAL_SUCCESS,
    FAILED
}
