package com.sjzm.product.modules.analysisbaseline.shopprofile.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("shop_profile_category")
public class ShopProfileCategoryEntity {
    @TableId(type = IdType.AUTO)
    private Long id;

    private String marketplace;
    private String sellerName;
    private String batchDate;
    private String variationMode;
    private String salesTier;
    private String categoryKey;
    private Integer productCount;
    private Long unitsSum;
    private BigDecimal unitsAvg;
    private BigDecimal unitsMedian;
    private String sourceTable;
    private LocalDateTime computedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
