package com.sjzm.dto;

import lombok.Data;
import java.io.Serializable;
import java.util.List;

@Data
public class DailyTrendResponse implements Serializable {
    private List<String> dates;
    private List<Integer> sales;
    private List<Double> revenue;

    public DailyTrendResponse() {
    }

    public DailyTrendResponse(List<String> dates, List<Integer> sales, List<Double> revenue) {
        this.dates = dates;
        this.sales = sales;
        this.revenue = revenue;
    }
}
