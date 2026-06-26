package com.sjzm.product.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("subcategory_baseline")
public class SubcategoryBaseline {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String marketplace;
    private String bsrId;
    private String canonicalKey;
    private String subCategory;
    private String baselineMonth;

    private Integer sampleSize;
    private Integer unitsP50;
    private Integer unitsP75;
    private Integer unitsP90;

    private BigDecimal priceP50;
    private String confidence;
    private LocalDateTime computedAt;
}
