package com.sjzm.product.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("deng_zong_shop_seller")
public class DengZongShopSeller {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String marketplace;
    private String sellerName;
    private String storeUrl;
    private String notes;
    private LocalDateTime lastSyncedAt;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
