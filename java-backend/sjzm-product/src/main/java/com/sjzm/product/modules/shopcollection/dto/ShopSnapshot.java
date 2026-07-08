package com.sjzm.product.modules.shopcollection.dto;

/**
 * 店铺快照值对象：封装一次店铺抓取运行记录的快照元信息。
 */
public record ShopSnapshot(
    String sourceRunId,
    String batchCode,
    String batchDate,
    String marketplace,
    String sellerName,
    Integer total,
    Integer fetchedCount,
    Integer writtenCount,
    Integer apiCalls
) {}
