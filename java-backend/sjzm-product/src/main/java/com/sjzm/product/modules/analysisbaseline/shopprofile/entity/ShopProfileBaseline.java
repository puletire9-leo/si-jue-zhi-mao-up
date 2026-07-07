package com.sjzm.product.modules.analysisbaseline.shopprofile.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("shop_profile_baseline")
public class ShopProfileBaseline {
    @TableId(type = IdType.AUTO)
    private Long id;

    private String baselineCode;
    private String baselineName;
    private String baselineType;
    private String marketplaceScope;
    private String categoryScope;
    private Integer shopCount;
    private String metricSummaryJson;
    private String status;
    private String createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
