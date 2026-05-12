package com.sjzm.dto;

import lombok.Data;
import java.io.Serializable;
import java.util.Map;

@Data
public class PeriodComparisonResponse implements Serializable {
    private PeriodData periodA;
    private PeriodData periodB;
    private Map<String, Double> changes;
    private Boolean isDeclining;
    private Double declinePercent;

    public PeriodComparisonResponse() {
    }

    public PeriodComparisonResponse(PeriodData periodA, PeriodData periodB, Map<String, Double> changes, Boolean isDeclining, Double declinePercent) {
        this.periodA = periodA;
        this.periodB = periodB;
        this.changes = changes;
        this.isDeclining = isDeclining;
        this.declinePercent = declinePercent;
    }
}
