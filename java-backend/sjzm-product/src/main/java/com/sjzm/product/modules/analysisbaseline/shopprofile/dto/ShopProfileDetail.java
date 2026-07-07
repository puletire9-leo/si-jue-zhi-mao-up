package com.sjzm.product.modules.analysisbaseline.shopprofile.dto;

import lombok.Data;

import java.util.List;

@Data
public class ShopProfileDetail {
    private ShopProfileSummary summary;
    private List<ShopProfileCategory> categories;
}
