package com.sjzm.product.modules.lingxing.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * Developer-to-SKU-prefix mapping.
 * Rebuilt weekly after unified table rebuild.
 * One developer can have multiple prefixes (e.g. 刘淼 → 257, 261).
 */
@Data
@TableName("lingxing_developer_sku_prefix")
public class LingxingDeveloperSkuPrefix {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** Developer name from unified table */
    private String developer;

    /** SKU prefix (first 3 digits of base_sku) */
    private String skuPrefix;

    /** Number of ASINs with this prefix for this developer */
    private Integer asinCount;

    /** Last update time */
    private LocalDateTime updatedAt;
}
