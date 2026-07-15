package com.sjzm.product.modules.developerselection.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Data
public class DeveloperSelectionBatchAddRequest {

    @NotBlank
    private String bucket;
    private Long targetUserId;
    private String developerName;

    @Valid
    @NotEmpty
    private List<Item> items;

    @Data
    public static class Item {
        @NotBlank
        private String asin;
        private String marketplace;
        private String originScene;
        private String originSource;
        private String snapshotKey;
        private String title;
        private String brand;
        private String imageUrl;
        private BigDecimal price;
        private Integer units;
        private Integer bsr;
        private Integer ratings;
        private BigDecimal rating;
        private Integer listingDays;
        private BigDecimal weightG;
        private String sellerName;
        private String nodeLabelPath;
        private String productUrl;
        private Map<String, Object> snapshot;
    }
}
