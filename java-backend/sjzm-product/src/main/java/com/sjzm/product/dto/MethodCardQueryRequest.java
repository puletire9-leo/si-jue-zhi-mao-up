package com.sjzm.product.dto;

import jakarta.validation.constraints.Min;
import lombok.Data;

@Data
public class MethodCardQueryRequest {

    private String marketplace = "UK";
    private String month;
    private String createdWeek;
    private String batchDate;
    private String bsrId;
    private Long nodeId;

    @Min(1)
    private Integer page = 1;

    @Min(1)
    private Integer size = 60;
}
