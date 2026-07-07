package com.sjzm.product.modules.analysisbaseline.shopprofile.service;

import com.sjzm.common.PageResult;
import com.sjzm.product.modules.analysisbaseline.shopprofile.dto.ShopProfileCategory;
import com.sjzm.product.modules.analysisbaseline.shopprofile.dto.ShopProfileComputeResult;
import com.sjzm.product.modules.analysisbaseline.shopprofile.dto.ShopProfileDetail;
import com.sjzm.product.modules.analysisbaseline.shopprofile.dto.ShopProfilePositioningComputeResult;
import com.sjzm.product.modules.analysisbaseline.shopprofile.dto.ShopProfilePositioningResult;
import com.sjzm.product.modules.analysisbaseline.shopprofile.dto.ShopProfileProduct;
import com.sjzm.product.modules.analysisbaseline.shopprofile.dto.ShopProfileSummary;

import java.util.List;

public interface ShopProfileService {
    List<ShopProfileSummary> summary(String marketplace, String batchDate, String sellerNameKeyword,
                                     Integer minProductCount, Integer limit);

    ShopProfileDetail detail(String marketplace, String sellerName, String batchDate);

    PageResult<ShopProfileProduct> products(String marketplace, String sellerName, String batchDate,
                                            String salesTier, String category, Integer page, Integer size);

    List<ShopProfileCategory> categories(String marketplace, String sellerName, String batchDate, String salesTier);

    ShopProfileComputeResult compute(String marketplace, String batchDate);

    List<ShopProfileSummary> snapshotSummary(String marketplace, String batchDate, String sellerNameKeyword,
                                             Integer minProductCount, Integer limit);

    List<ShopProfilePositioningResult> positioning(String baselineCode, String marketplace, String batchDate,
                                                   String sellerNameKeyword, Integer limit);

    ShopProfilePositioningResult positioningDetail(String marketplace, String sellerName,
                                                   String baselineCode, String batchDate);

    ShopProfilePositioningComputeResult computePositioning(String baselineCode, String marketplace, String batchDate);
}
