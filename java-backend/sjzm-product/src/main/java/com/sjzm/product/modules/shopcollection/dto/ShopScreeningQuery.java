package com.sjzm.product.modules.shopcollection.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class ShopScreeningQuery {
    private String marketplace;
    private String scope;
    private List<String> batchCodes;
    private List<String> sellerNames;
    private String sellerKeyword;
    private String watchlistStatus;
    private String sourceType;

    private BigDecimal priceMin;
    private BigDecimal priceMax;
    private Integer unitsMin;
    private Integer unitsMax;
    private Integer listingDaysMin;
    private Integer listingDaysMax;
    private Integer bsrMax;
    private BigDecimal weightMax;
    private Integer maxVariantCount;
    private List<String> fulfillment;
    private List<String> categories;
    private Boolean m01Only;

    private Integer minProductCount;
    private Integer minPassedProductCount;
    private Integer minM01HitCount;
    private Double avgListingDaysMax;

    private String sortBy;
    private String sortOrder;
    private Integer page;
    private Integer size;
    private boolean productFilterActive;

    public int getOffset() {
        int safePage = page == null || page < 1 ? 1 : page;
        int safeSize = size == null || size < 1 ? 30 : Math.min(size, 200);
        return (safePage - 1) * safeSize;
    }

    public int safePage() {
        return page == null || page < 1 ? 1 : page;
    }

    public int safeSize() {
        return size == null || size < 1 ? 30 : Math.min(size, 200);
    }
}
