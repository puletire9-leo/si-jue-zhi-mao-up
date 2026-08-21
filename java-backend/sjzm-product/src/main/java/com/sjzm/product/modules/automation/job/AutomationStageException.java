package com.sjzm.product.modules.automation.job;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/** Preserves completed stage timings when an automation job fails partway through. */
public class AutomationStageException extends RuntimeException {

    private final Map<String, Long> stageDurationsMs;

    public AutomationStageException(String stage, Map<String, Long> stageDurationsMs,
                                    RuntimeException cause) {
        super("Automation stage failed: " + stage + " - " + cause.getMessage(), cause);
        this.stageDurationsMs = Collections.unmodifiableMap(new LinkedHashMap<>(stageDurationsMs));
    }

    public Map<String, Long> getStageDurationsMs() {
        return stageDurationsMs;
    }
}
