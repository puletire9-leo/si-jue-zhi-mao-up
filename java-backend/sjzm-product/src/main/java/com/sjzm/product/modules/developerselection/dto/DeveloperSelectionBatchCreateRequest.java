package com.sjzm.product.modules.developerselection.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class DeveloperSelectionBatchCreateRequest {

    @NotBlank
    private String bucket;
    @NotBlank
    private String batchName;
    private Long targetUserId;
    private String developerName;
}
