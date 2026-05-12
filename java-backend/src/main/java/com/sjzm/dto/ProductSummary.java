package com.sjzm.dto;

import lombok.Data;
import java.io.Serializable;

@Data
public class ProductSummary implements Serializable {
    private String asin;
    private String title;
    private String sku;
    private String msku;
    private String shop;
    private Integer totalSales;
    private Double totalRevenue;

    public ProductSummary() {
    }

    public ProductSummary(String asin, String title, String sku, String msku, String shop, Integer totalSales, Double totalRevenue) {
        this.asin = asin;
        this.title = title;
        this.sku = sku;
        this.msku = msku;
        this.shop = shop;
        this.totalSales = totalSales;
        this.totalRevenue = totalRevenue;
    }
}
