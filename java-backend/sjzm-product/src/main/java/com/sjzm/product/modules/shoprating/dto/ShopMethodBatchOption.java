package com.sjzm.product.modules.shoprating.dto;

import lombok.Data;

import java.time.LocalDateTime;

/**
 * 方法卡找店可用的数据来源批次。
 *
 * <p>M01 当前固定读取 competitor_products_clean.effective_week_tag。前端用这个 DTO
 * 明确告诉操作者：候选店铺来自哪张表、哪个周批次、该批次有多少命中商品和店铺。</p>
 */
@Data
public class ShopMethodBatchOption {
    private String methodId;
    private String marketplace;
    private String batchCode;
    private String sourceTable;
    private String sourceWeekField;
    private Long productCount;
    private Long sellerCount;
    private LocalDateTime latestCreatedAt;
}
