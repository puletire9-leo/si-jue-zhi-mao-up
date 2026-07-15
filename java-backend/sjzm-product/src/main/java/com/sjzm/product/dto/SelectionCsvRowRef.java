package com.sjzm.product.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/** 筛选结果商品的数据库定位信息。 */
@Data
public class SelectionCsvRowRef {

    /** 前端能安全保真的数据库 ID；雪花 ID 若被 JS 转为不安全数字则留空。 */
    private String id;

    @NotBlank
    private String asin;

    /** 周批次、店铺批次等当前行快照标识，用于同 ASIN 多批次时精确定位。 */
    private String snapshotKey;
}
