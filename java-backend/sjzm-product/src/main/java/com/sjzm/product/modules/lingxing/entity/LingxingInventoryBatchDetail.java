package com.sjzm.product.modules.lingxing.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Daily inventory batch detail snapshot from Lingxing getBatchDetailList API.
 *
 * One row per (batch_no, sku, data_date).
 * Key fields:
 *   good_num         > 0 → 已入库待发亚马逊
 *   good_transit_num > 0 → 在途待入库
 */
@Data
@TableName("lingxing_inventory_batch_detail")
public class LingxingInventoryBatchDetail {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** SHA-256(batch_no|sku|data_date) */
    private String bizKey;

    /** Batch number from Lingxing */
    private String batchNo;

    /** SKU */
    private String sku;

    /** Developer matched by SKU prefix */
    private String developer;

    /** Operations staff (batch creator real name from Lingxing) */
    private String operator;

    /** SKU prefix used for matching */
    private String skuPrefix;

    /** Data date (sync date) */
    private LocalDate dataDate;

    /** Usable quantity (>0 = arrived at warehouse, ready for Amazon) */
    private Integer goodNum;

    /** Usable in-transit quantity (>0 = in transit to warehouse) */
    private Integer goodTransitNum;

    /** Total balance (in-transit + in-warehouse) */
    private Integer totalNum;

    /** In-warehouse balance */
    private Integer balanceNum;

    /** In-transit balance */
    private Integer transitBalanceNum;

    /** Warehouse name */
    private String whName;

    /** Stock-in type description */
    private String typeName;

    /** Stock-in time from Lingxing */
    private String purchaseInTime;

    /** Purchase order numbers (JSON array) */
    private String purchaseOrderSns;

    /** Purchase plan numbers (JSON array) */
    private String planSn;

    /** Raw Lingxing API response */
    private String rawJson;

    /** Sync time */
    private LocalDateTime syncedAt;

    /** Record creation time */
    private LocalDateTime createdAt;
}
