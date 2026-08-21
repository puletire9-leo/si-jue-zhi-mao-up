package com.sjzm.product.rds.finance.model;

import lombok.Data;

import java.time.LocalDate;

/** 财务日报使用的领星 Listing 最早上架日期。 */
@Data
public class FinanceListingDateRow {
    private String asin;
    private LocalDate listingDate;
}
