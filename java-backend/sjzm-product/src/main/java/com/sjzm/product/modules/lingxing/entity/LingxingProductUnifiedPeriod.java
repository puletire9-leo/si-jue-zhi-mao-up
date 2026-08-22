package com.sjzm.product.modules.lingxing.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 统一表时间窗。主键 period_start + period_end + marketplace + asin。
 * 日：起止同一天。周：起止为一周。
 */
@Data
@TableName("lingxing_product_unified_period")
public class LingxingProductUnifiedPeriod {
    private LocalDate periodStart;
    private LocalDate periodEnd;
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
