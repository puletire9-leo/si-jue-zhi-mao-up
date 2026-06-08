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
    private String sellerName; // 卖家名（卖家导入时使用），与 asin 分开存储
    private String title;
    private BigDecimal price;
    private Integer reviewCount;
    private String status;
    private String detail;
}
