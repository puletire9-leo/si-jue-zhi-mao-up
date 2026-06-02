package com.sjzm.product.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("product_click_log")
public class ProductClickLog {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;
    private String userName;
    private String asin;
    private String marketplace;
    private String source;
    private String action;
    private String productTitle;

    private LocalDateTime clickedAt;
}
