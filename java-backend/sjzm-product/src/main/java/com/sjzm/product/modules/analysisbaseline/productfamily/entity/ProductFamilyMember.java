package com.sjzm.product.modules.analysisbaseline.productfamily.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("product_family_member")
public class ProductFamilyMember {
    @TableId(type = IdType.AUTO)
    private Long id;

    private String familyCode;
    private String marketplace;
    private String asin;
    private String parentAsin;
    private String sellerName;
    private String sellerId;
    private String sourceTable;
    private String sourceBatch;
    private String matchType;
    private BigDecimal matchScore;
    private String salesTier;
    private Integer units;
    private Integer listingDays;
    private String categoryKey;
    private String evidenceJson;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
