package com.sjzm.product.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

/** 统一选品框架筛选结果 CSV 导出请求。 */
@Data
public class SelectionPageCsvExportRequest {

    /** competitor_clean / competitor_raw / deng_zong / shop_products / premium_products。 */
    @NotBlank
    private String source;

    @NotBlank
    private String marketplace;

    @Valid
    @NotEmpty
    @Size(max = 10000)
    private List<SelectionCsvRowRef> rows;
}
