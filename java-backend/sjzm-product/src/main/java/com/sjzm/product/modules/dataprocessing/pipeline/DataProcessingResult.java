package com.sjzm.product.modules.dataprocessing.pipeline;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

public record DataProcessingResult(
        long readCount,
        long writtenCount,
        long skippedCount,
        long failedCount,
        Map<String, Object> metadata) {

    public DataProcessingResult {
        metadata = metadata == null
                ? Map.of()
                : Collections.unmodifiableMap(new LinkedHashMap<>(metadata));
    }

    public static DataProcessingResult empty() {
        return new DataProcessingResult(0, 0, 0, 0, Map.of());
    }
}
