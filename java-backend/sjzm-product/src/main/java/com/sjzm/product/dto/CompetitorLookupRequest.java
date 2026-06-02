package com.sjzm.product.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

@Data
public class CompetitorLookupRequest {

    @NotBlank(message = "市场编码不能为空")
    private String marketplace;

    @JsonIgnore  // 不传给卖家精灵 API，仅用于内部 DB 记录
    private String month;

    private String brand;

    private String sellerName;

    @NotEmpty(message = "ASIN列表不能为空")
    private List<String> asins;

    private String nodeIdPath;
    private Boolean nodeIdPathEqual;
    private String keyword;
    private Integer matchType;
    private String variation;
    private Integer page = 1;
    private Integer size = 50;
    private String orderField;
    private Boolean orderDesc = true;
}
