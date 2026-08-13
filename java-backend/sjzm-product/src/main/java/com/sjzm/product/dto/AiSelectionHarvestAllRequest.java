package com.sjzm.product.dto;

import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

/**
 * AI 选品「一键同步本周全载体」请求 DTO。
 * 遍历所有 enabled 载体，全部写入当周批次 batch_&lt;ISO周&gt;。
 * 同周重复调用 = 增量更新（不新开批次）。
 */
@Data
public class AiSelectionHarvestAllRequest {

    /** 站点列表，如 [UK, DE, US]；三国合并进本周同一批次 */
    @NotEmpty(message = "站点不能为空")
    private List<String> marketplaces;
}
