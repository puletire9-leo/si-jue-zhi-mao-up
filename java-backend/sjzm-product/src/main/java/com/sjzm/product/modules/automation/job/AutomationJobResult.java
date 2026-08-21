package com.sjzm.product.modules.automation.job;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

public record AutomationJobResult(
        long totalCount,
        long successCount,
        long failedCount,
        long skippedCount,
        Map<String, Object> details) {

    public AutomationJobResult {
        details = details == null
                ? Map.of()
                : Collections.unmodifiableMap(new LinkedHashMap<>(details));
    }

    public static AutomationJobResult empty() {
        return new AutomationJobResult(0, 0, 0, 0, Map.of());
    }
}
