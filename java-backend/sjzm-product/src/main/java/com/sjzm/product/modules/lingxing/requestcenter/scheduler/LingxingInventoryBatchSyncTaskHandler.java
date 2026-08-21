package com.sjzm.product.modules.lingxing.requestcenter.scheduler;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sjzm.product.modules.lingxing.requestcenter.handler.LingxingTaskExecutionContext;
import com.sjzm.product.modules.lingxing.requestcenter.handler.LingxingTaskHandler;
import com.sjzm.product.modules.lingxing.requestcenter.handler.LingxingTaskResult;
import com.sjzm.product.modules.lingxing.service.LingxingInventoryBatchService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Map;

/** 在领星串行 worker 内执行每日库存批次同步。 */
@Component
@RequiredArgsConstructor
public class LingxingInventoryBatchSyncTaskHandler implements LingxingTaskHandler {

    public static final String TYPE = "LINGXING_INVENTORY_BATCH_SYNC";

    private final LingxingInventoryBatchService inventoryBatchService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public String taskType() {
        return TYPE;
    }

    @Override
    public LingxingTaskResult execute(LingxingTaskExecutionContext context) {
        String startDate = required(context, "startDate");
        String endDate = required(context, "endDate");
        String developer = context.getPayload().path("developer").asText(null);
        Map<String, Object> result = inventoryBatchService.syncDaily(startDate, endDate, developer);
        return LingxingTaskResult.success(objectMapper.valueToTree(result));
    }

    private String required(LingxingTaskExecutionContext context, String name) {
        String value = context.getPayload().path(name).asText("").trim();
        if (value.isEmpty()) throw new IllegalArgumentException(name + " 不能为空");
        return value;
    }
}
