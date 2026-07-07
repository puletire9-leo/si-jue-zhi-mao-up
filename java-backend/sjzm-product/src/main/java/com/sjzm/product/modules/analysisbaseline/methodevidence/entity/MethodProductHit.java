package com.sjzm.product.modules.analysisbaseline.methodevidence.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("method_product_hit")
public class MethodProductHit {
    @TableId(type = IdType.AUTO)
    private Long id;

    private String methodId;
    private String marketplace;
    private String asin;
    private String parentAsin;
    private String sellerName;
    private String sellerId;
    private String sourceTable;
    private String sourceBatch;
    private String hitReasonJson;
    private String ruleSnapshotJson;
    private String hitStatus;
    private LocalDateTime computedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
