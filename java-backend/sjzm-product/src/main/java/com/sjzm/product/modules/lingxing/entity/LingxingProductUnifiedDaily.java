package com.sjzm.product.modules.lingxing.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

/** 统一表国家+ASIN 日快照。主键 data_date + marketplace + asin。 */
@Data
@TableName("lingxing_product_unified_daily")
public class LingxingProductUnifiedDaily {
    private LocalDate dataDate;
    private String marketplace;
    private String asin;
    private String parentAsin;
    private String country;
    private String developer;
    private String principal;
    private String listingTags;
    private LocalDate listingDate;
    private String productCreateTime;
    private String title;
    private String baseSku;
    private LocalDateTime syncedAt;
}
