package com.sjzm.product.modules.automation.job;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.sjzm.product.modules.automation.dto.AutomationRunRequest;
import com.sjzm.product.modules.automation.entity.AutomationRun;
import com.sjzm.product.modules.automation.service.AutomationCenterService;
import com.sjzm.product.modules.lingxing.requestcenter.handler.LingxingTaskExecutionContext;
import com.sjzm.product.modules.lingxing.requestcenter.handler.LingxingTaskHandler;
import com.sjzm.product.modules.lingxing.requestcenter.handler.LingxingTaskResult;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * 运营物流在领星请求中心中的强类型入口。
 *
 * <p>注册排期只生成请求任务；本处理器复用自动化中心的运行审计、互斥和业务编排。</p>
 */
@Component
@RequiredArgsConstructor
public class OperationsLogisticsLingxingTaskHandler implements LingxingTaskHandler {

    private final AutomationCenterService automationCenterService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public String taskType() {
        return OperationsLogisticsPurchaseProgressJob.CODE;
    }

    @Override
    public LingxingTaskResult execute(LingxingTaskExecutionContext context) {
        Map<String, Object> parameters = context.getPayload() == null
                || context.getPayload().isNull()
                ? Map.of()
                : objectMapper.convertValue(context.getPayload(), new TypeReference<>() { });
        AutomationRunRequest request = new AutomationRunRequest();
        request.setTriggerType("EVENT");
        request.setCorrelationId("lingxing-request:" + context.getTaskId());
        request.setParameters(parameters);
        AutomationRun run = automationCenterService.trigger(
                OperationsLogisticsPurchaseProgressJob.CODE,
                "lingxing-request-center", request);
        ObjectNode result = objectMapper.createObjectNode();
        result.put("automationRunNo", run.getRunNo());
        result.put("automationStatus", run.getStatus());
        result.put("totalCount", run.getTotalCount());
        result.put("successCount", run.getSuccessCount());
        result.put("failedCount", run.getFailedCount());
        result.put("skippedCount", run.getSkippedCount());
        return LingxingTaskResult.success(result);
    }
}
