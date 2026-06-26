package com.sjzm.product.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("category_age_tier_baseline")
public class CategoryAgeTierBaseline {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String marketplace;
    private String bsrId;
    private String ageBucket;
    private String baselineMonth;

    private Integer sampleSize;
    private Integer unitsP25;
    private Integer unitsP50;
    private Integer unitsP75;
    private Integer unitsP90;

    private Integer bsrP10;
    private Integer bsrP25;
    private Integer bsrP50;
    private Integer bsrP75;

    private BigDecimal priceP50;
    private String confidence;
    private LocalDateTime computedAt;
}
