package com.sjzm.product.dto;

import jakarta.validation.constraints.Min;
import lombok.Data;

import java.util.List;

@Data
public class MethodCardQueryRequest {

    private String marketplace = "UK";
    private String month;
    private String createdWeek;
    /** M01 周批次多选；createdWeek 保留用于兼容旧调用方。 */
    private List<String> createdWeeks;
    private String batchDate;
    private String bsrId;
    private Long nodeId;

    @Min(1)
    private Integer page = 1;

    @Min(1)
    private Integer size = 60;
}
