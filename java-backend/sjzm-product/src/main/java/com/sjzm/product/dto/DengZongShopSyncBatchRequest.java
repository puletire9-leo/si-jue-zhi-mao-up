package com.sjzm.product.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Positive;
import lombok.Data;

import java.util.List;

/** 非标店铺上新专用抓取请求，只接受已登记的店铺 ID。 */
@Data
public class DengZongShopSyncBatchRequest {

    @NotEmpty(message = "至少选择一个非标店铺")
    private List<@Positive(message = "店铺 ID 必须为正数") Long> sellerIds;
}
