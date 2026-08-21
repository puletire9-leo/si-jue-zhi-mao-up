package com.sjzm.product.modules.automation.dto;

import lombok.Data;

import java.util.Map;

@Data
public class AutomationRunRequest {
    private String triggerType;
    private String correlationId;
    private Map<String, Object> parameters;
}
