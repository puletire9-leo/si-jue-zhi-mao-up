package com.sjzm.product.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("shops")
public class Shop {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String shopId;
    private String shopName;
    private String shopLink;
    private String marketplace;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
