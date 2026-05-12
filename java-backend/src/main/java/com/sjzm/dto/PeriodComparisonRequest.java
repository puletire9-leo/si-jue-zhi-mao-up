package com.sjzm.dto;

import lombok.Data;
import java.io.Serializable;
import java.util.List;

@Data
public class PeriodComparisonRequest implements Serializable {
    private List<String> asins;
    private PeriodRange periodA;
    private PeriodRange periodB;
    private List<String> shops;

    @Data
    public static class PeriodRange implements Serializable {
        private String startDate;
        private String endDate;
    }
}
