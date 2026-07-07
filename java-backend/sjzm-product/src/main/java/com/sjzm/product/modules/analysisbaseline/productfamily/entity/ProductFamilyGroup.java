package com.sjzm.product.modules.analysisbaseline.productfamily.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("product_family_group")
public class ProductFamilyGroup {
    @TableId(type = IdType.AUTO)
    private Long id;

    private String familyCode;
    private String marketplace;
    private String familyName;
    private String seedAsin;
    private String seedSalesTier;
    private String categoryKey;
    private String titleSignature;
    private BigDecimal priceMin;
    private BigDecimal priceMax;
    private String evidenceJson;
    private String status;
    private LocalDateTime computedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
