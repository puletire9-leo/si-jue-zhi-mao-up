package com.sjzm.product.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("skip_asins")
public class SkipAsin {
    @TableId(type = IdType.ASSIGN_ID)
    private Long id;
    private String asin;
    private String title;
    private String imageUrl;
    private BigDecimal price;
    private Integer bsr;
    private Integer monthlySales;
    private Integer listingDays;
    private BigDecimal weightG;
    private String fulfillment;
    private String sellerNation;
    private String filterReasons;
    private String marketplace;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
