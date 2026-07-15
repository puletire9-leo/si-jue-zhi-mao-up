package com.sjzm.product.modules.developerselection.dto;

import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

@Data
public class DeveloperSelectionBatchActionRequest {

    @NotEmpty
    private List<Long> ids;
    private String targetBucket;
}
