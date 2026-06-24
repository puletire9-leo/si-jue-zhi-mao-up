package com.sjzm.product.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("category_bsr_baseline")
public class CategoryBsrBaseline {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String marketplace;
    private String bsrId;
    private String bsrBucket;
    private String baselineMonth;

    private Integer sampleSize;
    private Integer unitsP25;
    private Integer unitsP50;
    private Integer unitsP75;

    private BigDecimal priceAvg;
    private String confidence;
    private LocalDateTime computedAt;
}
