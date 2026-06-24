package com.sjzm.product.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * ③线真实战绩表。
 *
 * 存储 591+ 条历史赢家的原始表现与半自动打标结果，
 * 作为后续 ①②④ 线校准与回测的真值基线。
 */
@Data
@TableName("product_performance_actual")
public class ProductPerformanceActual {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    private String asin;
    private String parentAsin;
    private String sku;
    private String marketplace;

    private BigDecimal price;
    private Integer salesVolume;

    private String categoryRankMain;
    private String categoryMain;
    private String categoryRankSub;
    private String categorySub;

    private BigDecimal acoas;
    private Integer naturalClicks;
    private BigDecimal ctr;
    private BigDecimal adCvr;
    private Integer naturalOrders;
    private Integer fbaAvailable;
    private BigDecimal refundRate;

    private String productName;
    private String title;

    private String archetype;
    private String element;
    private String carrier;

    private String listingTags;
    private Integer isEliminated;
    private Integer isGreen;
    private String bsrId;
    private String sourceBatch;
    private LocalDateTime importedAt;
}
