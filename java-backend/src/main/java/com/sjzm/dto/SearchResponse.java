package com.sjzm.dto;

import lombok.Data;
import java.io.Serializable;
import java.util.List;

@Data
public class SearchResponse implements Serializable {
    private Long total;
    private List<ProductSummary> products;
    private Boolean hasMore;

    public SearchResponse() {
    }

    public SearchResponse(Long total, List<ProductSummary> products, Boolean hasMore) {
        this.total = total;
        this.products = products;
        this.hasMore = hasMore;
    }
}
