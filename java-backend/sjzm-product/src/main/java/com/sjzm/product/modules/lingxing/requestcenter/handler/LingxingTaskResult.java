package com.sjzm.product.modules.lingxing.requestcenter.handler;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * 领星任务执行结果。success=false 时任务进入 FAILED，message 作为错误摘要。
 */
public record LingxingTaskResult(
        boolean success,
        String message,
        JsonNode data
) {

    public static LingxingTaskResult success(JsonNode data) {
        return new LingxingTaskResult(true, null, data);
    }

    public static LingxingTaskResult success(String message, JsonNode data) {
        return new LingxingTaskResult(true, message, data);
    }

    public static LingxingTaskResult failure(String message) {
        return new LingxingTaskResult(false, message, null);
    }
}
