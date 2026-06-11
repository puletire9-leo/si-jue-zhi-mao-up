package com.sjzm.product.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("category_heat_matrix")
public class CategoryHeatRow {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String marketplace;
    private String month;
    private String category;
    private Integer dengzongCount;
    private Integer externalSCount;
    private Integer externalACount;
    private Integer totalSellerCount;
    private BigDecimal dengzongRatio;
    private BigDecimal smartDensity;
    private String heatSignal;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
