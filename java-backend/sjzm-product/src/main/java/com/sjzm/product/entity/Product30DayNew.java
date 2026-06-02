package com.sjzm.product.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("product_30day_new")
public class Product30DayNew {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String asin;
    private String title;
    private String imageUrl;
    private String productUrl;
    private BigDecimal price;
    private Integer bsr;
    private Integer monthlySales;
    private Integer listingDays;
    private String shopName;
    private String filterStatus;
    private String filterReasons;
    private String marketplace;
    private String dataMonth;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
