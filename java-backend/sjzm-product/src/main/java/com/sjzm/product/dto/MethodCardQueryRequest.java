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
    /** 一级榜单分类，取 node_label_path 冒号前第一段；数组可安全承载分类名中的逗号。 */
    private List<String> categories;

    @Min(1)
    private Integer page = 1;

    @Min(1)
    private Integer size = 60;
}
