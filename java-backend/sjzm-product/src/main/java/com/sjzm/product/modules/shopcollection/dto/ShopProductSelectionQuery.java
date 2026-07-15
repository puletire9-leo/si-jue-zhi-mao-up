package com.sjzm.product.modules.shopcollection.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

/**
 * 统一选品页读取店铺商品的查询条件。
 *
 * <p>字段口径与竞品选品查询保持一致，数据源固定为 {@code shop_products}。</p>
 */
@Data
public class ShopProductSelectionQuery {

    private Integer page = 1;
    private Integer size = 60;
    private String marketplace;
    private List<String> asins;
    private String title;
    private String sellerName;
    private String brand;
    private List<String> categories;
    private List<String> batchDates;
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
    private List<String> grade;
    private String sortBy;
    private String sortOrder;
    /**
     * 可选的方法规则。店铺选品只接受 M01、M03；规则叠加在 shop_products 上，
     * 不允许借由方法卡切换至新品榜或非标店铺数据源。
     */
    private String methodId;
}
