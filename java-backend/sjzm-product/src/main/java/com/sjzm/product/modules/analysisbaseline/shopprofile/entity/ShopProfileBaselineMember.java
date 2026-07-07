package com.sjzm.product.modules.analysisbaseline.shopprofile.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("shop_profile_baseline_member")
public class ShopProfileBaselineMember {
    @TableId(type = IdType.AUTO)
    private Long id;

    private String baselineCode;
    private String marketplace;
    private String sellerName;
    private String sellerId;
    private String sourceReason;
    private BigDecimal weight;
    private String status;
    private LocalDateTime addedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
