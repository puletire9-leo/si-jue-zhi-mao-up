package com.sjzm.product.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

/**
 * AI 选品投递请求 DTO。
 * AI Agent 或手动导入时传入：ASIN 列表 + 站点 + 批次名称。
 */
@Data
public class AiSelectionPushRequest {

    /** 要投递/导入的 ASIN 列表（不允许为空） */
    @NotEmpty(message = "ASIN 列表不能为空")
    private List<String> asins;

    /** 站点，如 UK / US / DE */
    @NotBlank(message = "站点不能为空")
    private String marketplace;

    /** 批次名称，如 "2026-07-27 UK 挂牌候选" */
    private String batchLabel;
}
