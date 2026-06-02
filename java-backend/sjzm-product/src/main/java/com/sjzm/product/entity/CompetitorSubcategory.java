package com.sjzm.product.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

@Data
@TableName("competitor_subcategories")
public class CompetitorSubcategory {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long productId;
    private String code;
    @TableField("rank_value")
    private Integer rankValue;
    private String label;
}
