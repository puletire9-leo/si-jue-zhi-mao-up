package com.sjzm.product.modules.dataprocessing.dto;

import lombok.Data;

import java.util.Map;

@Data
public class DataProcessingRunRequest {
    private String triggerType;
    private String correlationId;
    private Map<String, Object> parameters;
}
