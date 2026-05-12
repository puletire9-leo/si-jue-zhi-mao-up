package com.sjzm.dto;

import lombok.Data;
import java.io.Serializable;

@Data
public class PeriodTrendComparisonResponse implements Serializable {
    private DailyTrendResponse periodA;
    private DailyTrendResponse periodB;

    public PeriodTrendComparisonResponse() {
    }

    public PeriodTrendComparisonResponse(DailyTrendResponse periodA, DailyTrendResponse periodB) {
        this.periodA = periodA;
        this.periodB = periodB;
    }
}
