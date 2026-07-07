package com.sjzm.product.modules.analysisbaseline.shopprofile.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("shop_profile_snapshot")
public class ShopProfileSnapshot {
    @TableId(type = IdType.AUTO)
    private Long id;

    private String marketplace;
    private String sellerName;
    private String sellerId;
    private String batchDate;
    private String variationMode;
    private Integer productCount;
    private Integer aCount;
    private Integer bCount;
    private Integer cCount;
    private Integer dCount;
    private Integer unknownCount;
    private Integer abCount;
    @TableField("abc_count")
    private Integer abcCount;
    private BigDecimal aRatio;
    private BigDecimal abRatio;
    @TableField("abc_ratio")
    private BigDecimal abcRatio;
    private BigDecimal dRatio;
    private String topACategory;
    @TableField("top_abc_category")
    private String topABCCategory;
    private String topDCategory;
    private Integer newCount;
    private Integer growingCount;
    private Integer matureCount;
    private Integer dNewCount;
    private Integer dOldCount;
    @TableField("d_abc_overlap_ratio")
    private BigDecimal dAbcOverlapRatio;
    private String methodHitSummaryJson;
    private String profileType;
    private String sourceTable;
    private LocalDateTime computedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
