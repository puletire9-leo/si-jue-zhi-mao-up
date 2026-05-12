package com.sjzm.dto;

import lombok.Data;
import java.io.Serializable;
import java.util.List;
import java.util.Map;

@Data
public class WeeklySalesResponse implements Serializable {
    private List<String> weeks;
    private List<String> weekLabels;
    private Map<String, List<Integer>> data;
    private Map<String, List<Double>> revenueData;

    public WeeklySalesResponse() {
    }

    public WeeklySalesResponse(List<String> weeks, List<String> weekLabels, Map<String, List<Integer>> data, Map<String, List<Double>> revenueData) {
        this.weeks = weeks;
        this.weekLabels = weekLabels;
        this.data = data;
        this.revenueData = revenueData;
    }
}
