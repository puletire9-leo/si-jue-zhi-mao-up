package com.sjzm.product.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("competitor_lookup_log")
public class CompetitorLookupLog {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String marketplace;
    private String month;
    private Integer asinsCount;
    private Integer tookMs;
    private Integer pages;
    private Integer total;
    private String apiStatus;
    private String errorMessage;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
