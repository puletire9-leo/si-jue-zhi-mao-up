package com.sjzm.product.modules.lingxing.requestcenter.dto;

import lombok.Data;

import java.time.LocalDate;

@Data
public class UnifiedPeriodBackfillRequest {
    private LocalDate weeklyFrom;
    private LocalDate weeklyTo;
    private LocalDate dailyFrom;
    private LocalDate dailyTo;
    private Boolean publishToFeishu;
    private Boolean allowRepull;
    private String operator;
}
