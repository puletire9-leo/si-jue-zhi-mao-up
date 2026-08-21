package com.sjzm.product.modules.automation.job;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

public record AutomationExecutionContext(
        Long runId,
        String runNo,
        String triggerType,
        String requestedBy,
        String correlationId,
        Map<String, Object> parameters) {

    public AutomationExecutionContext {
        parameters = parameters == null
                ? Map.of()
                : Collections.unmodifiableMap(new LinkedHashMap<>(parameters));
    }
}
