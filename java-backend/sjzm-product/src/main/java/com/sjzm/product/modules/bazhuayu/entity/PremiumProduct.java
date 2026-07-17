package com.sjzm.product.modules.bazhuayu.entity;

import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import com.sjzm.product.entity.CompetitorProduct;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 精品榜商品数据。字段主体与 competitor_products 一致，但物理表完全独立，
 * 不参加新品榜初筛、评分或 clean 层刷新。
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("premium_products")
public class PremiumProduct extends CompetitorProduct {

    private Long bazhuayuMappingId;
    private String bazhuayuTaskId;
    private String bazhuayuTaskName;
    private String sourceRunId;
    private String bazhuayuRawJson;
    private String sellerspriteRawJson;

    @TableLogic
    private Integer deleted;
}
