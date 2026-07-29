package com.sjzm.product.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * AI 选品投递响应 DTO。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiSelectionPushResult {

    /** 新生成的批次 ID */
    private String batchId;

    /** 批次名称 */
    private String batchLabel;

    /** 成功投递的商品数 */
    private Integer total;

    /** 请求的 ASIN 总数 */
    private Integer requested;

    /** 未在源数据表中找到的 ASIN */
    private List<String> invalidAsins;

    /** 投递成功的前 20 条商品概览 */
    private List<AiSelectionProductBrief> products;
}
