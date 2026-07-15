package com.sjzm.product.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

@Data
public class SelectionUsersRequest {

    @NotEmpty
    private List<@NotBlank String> asins;

    @NotBlank
    private String marketplace = "UK";
}
