package com.sjzm.product.modules.lingxing.requestcenter.handler;

import com.fasterxml.jackson.databind.JsonNode;
import com.sjzm.product.modules.lingxing.service.LingxingClient;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 领星任务执行上下文：向处理器暴露任务标识、载荷和领星客户端。
 *
 * <p>处理器通过 {@link #client()} 调用领星业务接口；客户端的账号级串行化门禁
 * 已保证所有 post/get 跨入口串行，处理器无需自行加锁。</p>
 */
@Getter
@RequiredArgsConstructor
public class LingxingTaskExecutionContext {

    private final String taskId;

    private final JsonNode payload;

    private final LingxingClient client;
}
