package com.sjzm.product.modules.dataprocessing.logistics.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("operations_logistics_purchase_progress")
public class OperationsLogisticsPurchaseProgress {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String businessKey;
    private String orderSn;
    private Long itemId;
    private String planSn;
    private String ppgSn;
    private String sku;
    private LocalDateTime stockTime;
    private Integer purchaseQuantity;
    private Integer receivedQuantity;
    private Integer availableQuantity;
    private Integer validShippedQuantity;
    private String progressStatus;
    private BigDecimal progressValue;
    private String followUpStatus;
    private String associationStatus;
    private String sourceHash;
    private Integer terminal;
    private LocalDateTime calculatedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
