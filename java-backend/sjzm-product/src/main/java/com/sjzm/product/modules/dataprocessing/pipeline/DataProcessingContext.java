package com.sjzm.product.modules.dataprocessing.pipeline;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

public record DataProcessingContext(
        String triggerType,
        String requestedBy,
        String correlationId,
        Map<String, Object> parameters) {

    public DataProcessingContext {
        triggerType = textOrDefault(triggerType, "MANUAL");
        requestedBy = textOrDefault(requestedBy, "system");
        correlationId = textOrDefault(correlationId, "");
        parameters = parameters == null
                ? Map.of()
                : Collections.unmodifiableMap(new LinkedHashMap<>(parameters));
    }

    private static String textOrDefault(String value, String defaultValue) {
        return value == null || value.isBlank() ? defaultValue : value.trim();
    }
}
