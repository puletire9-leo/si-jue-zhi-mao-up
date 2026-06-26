package com.sjzm.product.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("blue_ocean_scan_results")
public class BlueOceanScanResult {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String marketplace;
    private String month;
    private String category;
    private String opportunityType;
    private BigDecimal blueOceanScore;
    private String radarJson;
    private String recommendationsJson;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
