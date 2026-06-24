package com.sjzm.product.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("subcategory_alias_map")
public class SubcategoryAliasMap {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    private String sourceType;
    private String marketplace;
    private String rawSubcategory;
    private String normalizedSubcategory;
    private String canonicalKey;
    private String canonicalName;
    private String carrierHint;
    private Integer sampleCount;
    private String latestMonth;
    private String matchMethod;
    private String status;
    private String notes;

    @TableLogic
    private Integer deleted;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
