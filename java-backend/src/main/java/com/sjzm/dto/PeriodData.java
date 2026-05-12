package com.sjzm.dto;

import lombok.Data;
import java.io.Serializable;

@Data
public class PeriodData implements Serializable {
    private String label;
    private String startDate;
    private String endDate;
    private String dateRange;
    private Integer orders;
    private Integer sales;
    private Double revenue;
    private Double grossProfit;
    private Double grossProfitRate;
    private Double settlementProfit;
    private Double settlementProfitRate;
    private Double adSpend;
    private Integer adOrders;
    private Double adAcos;
    private Double refundAmount;
    private Integer refundCount;
    private Double refundRate;

    public PeriodData() {
        this.orders = 0;
        this.sales = 0;
        this.revenue = 0.0;
        this.grossProfit = 0.0;
        this.grossProfitRate = 0.0;
        this.settlementProfit = 0.0;
        this.settlementProfitRate = 0.0;
        this.adSpend = 0.0;
        this.adOrders = 0;
        this.adAcos = 0.0;
        this.refundAmount = 0.0;
        this.refundCount = 0;
        this.refundRate = 0.0;
    }
}
