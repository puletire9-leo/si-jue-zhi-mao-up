package com.sjzm.product.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("follow_signals")
public class FollowSignal {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String marketplace;
    private String month;
    private String category;
    private String firstSeller;
    private String firstAsin;
    private Integer firstListingDays;
    private Integer followerCount;
    private Integer smartFollowerCount;
    private String signalStrength;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
