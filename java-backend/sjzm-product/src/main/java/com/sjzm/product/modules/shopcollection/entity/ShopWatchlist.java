package com.sjzm.product.modules.shopcollection.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 店铺观察池：记录哪些店铺值得盯，以及为什么值得盯。
 * 是"方法卡命中 / 基线 / 人工判断"进入店铺分析链路的入口，
 * 回答"这家店为什么进观察池、因为哪张方法卡或哪个基线进来的"。
 */
@Data
@TableName("shop_watchlist")
public class ShopWatchlist {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String marketplace;
    private String sellerName;
    private String sellerId;

    /** METHOD_CARD / BASELINE / MANUAL / OWN_GOOD_SIMILAR / CATEGORY */
    private String sourceType;
    /** M01 / M03 / ZHENG_UK_DE / OWN_GOOD_SHOPS 等 */
    private String sourceCode;
    private String reason;
    private Integer hitCount;
    private String topCategory;
    /** WATCHING / FETCHED / CONFIRMED / IGNORED */
    private String status;
    private String lastFetchRunId;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
