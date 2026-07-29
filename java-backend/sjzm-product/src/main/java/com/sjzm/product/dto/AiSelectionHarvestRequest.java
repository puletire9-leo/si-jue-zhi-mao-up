package com.sjzm.product.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

/**
 * AI 选品全量捞取请求 DTO。
 * 按载体的检索词，从 shop_products / competitor_products_clean 全批次双通道捞取。
 * 支持一次传多个站点：三国合并进「一个批次」，相对 载体+站点+ASIN 历史增量去重。
 */
@Data
public class AiSelectionHarvestRequest {

    /** 载体键，如 guapai */
    @NotBlank(message = "载体不能为空")
    private String carrierKey;

    /** 站点列表，如 [UK, DE, US]；一次请求多国合并为一个增量批次 */
    @NotEmpty(message = "站点不能为空")
    private List<String> marketplaces;
}
