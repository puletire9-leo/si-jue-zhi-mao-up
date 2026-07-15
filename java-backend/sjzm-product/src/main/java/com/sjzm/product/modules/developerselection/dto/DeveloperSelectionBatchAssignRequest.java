package com.sjzm.product.modules.developerselection.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
public class DeveloperSelectionBatchAssignRequest {

    @NotEmpty
    private List<Long> ids;
    @NotNull
    private Long batchId;
}
