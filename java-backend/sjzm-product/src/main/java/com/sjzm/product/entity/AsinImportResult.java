package com.sjzm.product.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.math.BigDecimal;

@Data
@TableName("asin_import_results")
public class AsinImportResult {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long taskId;
    private String asin;
    private String title;
    private BigDecimal price;
    private Integer reviewCount;
    private String status;
    private String detail;
}
