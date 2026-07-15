package com.sjzm.product.modules.requestcenter.gateway.model;

import com.sjzm.product.modules.requestcenter.model.SellerspriteExecutionErrorCode;

import java.time.LocalDateTime;
import java.util.Objects;

/**
 * 卖家精灵执行失败的结构化异常。
 * requestDispatched=false 表示调用在本服务侧被拦截或连接尚未建立，不得作为已计费失败处理。
 */
public class SellerspriteExecutionException extends RuntimeException {

    private final SellerspriteExecutionErrorCode errorCode;
    private final boolean requestDispatched;
    private final boolean usageConfirmed;
    private final LocalDateTime retryAt;

    public SellerspriteExecutionException(SellerspriteExecutionErrorCode errorCode, String message,
                                          boolean requestDispatched, boolean usageConfirmed,
                                          LocalDateTime retryAt, Throwable cause) {
        super(message, cause);
        this.errorCode = Objects.requireNonNull(errorCode, "errorCode 不能为空");
        this.requestDispatched = requestDispatched;
        this.usageConfirmed = usageConfirmed;
        this.retryAt = retryAt;
    }

    public SellerspriteExecutionErrorCode getErrorCode() {
        return errorCode;
    }

    public boolean isRequestDispatched() {
        return requestDispatched;
    }

    public boolean isUsageConfirmed() {
        return usageConfirmed;
    }

    public LocalDateTime getRetryAt() {
        return retryAt;
    }
}
