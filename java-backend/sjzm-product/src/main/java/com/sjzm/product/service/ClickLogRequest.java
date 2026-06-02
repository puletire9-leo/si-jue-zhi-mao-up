package com.sjzm.product.service;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ClickLogRequest {

    @NotBlank
    private String asin;

    @NotBlank
    private String marketplace;

    @NotBlank
    private String source;

    @NotBlank
    private String action;

    private Long userId;
    private String productTitle;
    private String userName;
}
