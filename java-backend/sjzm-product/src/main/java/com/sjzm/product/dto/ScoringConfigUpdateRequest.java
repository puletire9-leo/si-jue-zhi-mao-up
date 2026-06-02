package com.sjzm.product.dto;

import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class ScoringConfigUpdateRequest {
    private List<DimensionConfig> dimensions;
    private List<Map<String, Object>> gradeThresholds;

    @Data
    public static class DimensionConfig {
        private Long id;
        private String dimensionKey;
        private String displayName;
        private Double weight;
        private List<ThresholdConfig> thresholds;
        private Boolean isActive;
    }

    @Data
    public static class ThresholdConfig {
        private Double min;
        private Double max;
        private Integer score;
    }
}
