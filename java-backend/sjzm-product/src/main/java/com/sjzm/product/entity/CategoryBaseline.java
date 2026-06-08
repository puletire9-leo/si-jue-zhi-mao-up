package com.sjzm.product.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("category_baselines")
public class CategoryBaseline {

    @TableId(type = IdType.AUTO)
    private Long id;

    // 品类标识
    private String marketplace;
    private String categoryLabel;
    private String archetype;

    // 样本统计
    private Integer sampleSize;
    private String baselineMonth;

    // 8维百分位基线 - size
    private BigDecimal p25Size;
    private BigDecimal p50Size;
    private BigDecimal p75Size;

    // volume
    private BigDecimal p25Volume;
    private BigDecimal p50Volume;
    private BigDecimal p75Volume;

    // profit
    private BigDecimal p25Profit;
    private BigDecimal p50Profit;
    private BigDecimal p75Profit;

    // emotion
    private BigDecimal p25Emotion;
    private BigDecimal p50Emotion;
    private BigDecimal p75Emotion;

    // decor
    private BigDecimal p25Decor;
    private BigDecimal p50Decor;
    private BigDecimal p75Decor;

    // fission
    private BigDecimal p25Fission;
    private BigDecimal p50Fission;
    private BigDecimal p75Fission;

    // culture
    private BigDecimal p25Culture;
    private BigDecimal p50Culture;
    private BigDecimal p75Culture;

    // market
    private BigDecimal p25Market;
    private BigDecimal p50Market;
    private BigDecimal p75Market;

    // 品类健康度指标
    private BigDecimal avgGrowthRate;
    private BigDecimal avgCr3;
    private BigDecimal avgMargin;
    private BigDecimal avgRating;
    private Integer totalProducts;

    // 元数据
    private LocalDateTime computedAt;
    private String dataSource;
    private BigDecimal confidence;
}
