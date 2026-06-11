package com.sjzm.product.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("seller_profiles")
public class SellerProfile {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String marketplace;
    private String month;
    private String sellerName;
    private Integer isDengzong;
    private BigDecimal smartScore;
    private BigDecimal visionScore;
    private BigDecimal newSuccessRate;
    private BigDecimal profitPercentile;
    private String grade;
    private String archetype;
    private Integer productCount;
    private Integer newProductCount;
    private BigDecimal avgUnits;
    private Integer avgBsr;
    private String categoryFocus;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
