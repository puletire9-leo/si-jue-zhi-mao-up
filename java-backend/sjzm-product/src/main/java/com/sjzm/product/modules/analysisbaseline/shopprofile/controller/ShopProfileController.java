package com.sjzm.product.modules.analysisbaseline.shopprofile.controller;

import com.sjzm.common.PageResult;
import com.sjzm.common.Result;
import com.sjzm.product.modules.analysisbaseline.shopprofile.dto.ShopProfileCategory;
import com.sjzm.product.modules.analysisbaseline.shopprofile.dto.ShopProfileComputeResult;
import com.sjzm.product.modules.analysisbaseline.shopprofile.dto.ShopProfileDetail;
import com.sjzm.product.modules.analysisbaseline.shopprofile.dto.ShopProfilePositioningComputeResult;
import com.sjzm.product.modules.analysisbaseline.shopprofile.dto.ShopProfilePositioningResult;
import com.sjzm.product.modules.analysisbaseline.shopprofile.dto.ShopProfileProduct;
import com.sjzm.product.modules.analysisbaseline.shopprofile.dto.ShopProfileSummary;
import com.sjzm.product.modules.analysisbaseline.shopprofile.service.ShopProfileService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/shop-profile")
@RequiredArgsConstructor
@Tag(name = "店铺画像", description = "analysis-baseline 店铺画像证据层")
public class ShopProfileController {

    private final ShopProfileService shopProfileService;

    @GetMapping("/summary")
    @Operation(summary = "店铺画像列表", description = "按店铺聚合 A/B/C/D、ABC 稳定盘、D 测品池和 top 类目")
    public Result<List<ShopProfileSummary>> summary(
            @RequestParam String marketplace,
            @RequestParam(required = false) String batchDate,
            @RequestParam(required = false) String sellerName,
            @RequestParam(required = false) Integer minProductCount,
            @RequestParam(defaultValue = "100") Integer limit) {
        return Result.success(shopProfileService.summary(marketplace, batchDate, sellerName, minProductCount, limit));
    }

    @PostMapping("/compute")
    @Operation(summary = "物化店铺画像", description = "写入 shop_profile_snapshot / shop_profile_category；执行前需先运行 create_analysis_baseline_tables.sql")
    public Result<ShopProfileComputeResult> compute(
            @RequestParam String marketplace,
            @RequestParam(required = false) String batchDate) {
        return Result.success(shopProfileService.compute(marketplace, batchDate));
    }

    @GetMapping("/snapshots")
    @Operation(summary = "物化店铺画像列表", description = "从 shop_profile_snapshot 读取，执行前需先运行 SQL 并调用 compute")
    public Result<List<ShopProfileSummary>> snapshots(
            @RequestParam String marketplace,
            @RequestParam(required = false) String batchDate,
            @RequestParam(required = false) String sellerName,
            @RequestParam(required = false) Integer minProductCount,
            @RequestParam(defaultValue = "100") Integer limit) {
        return Result.success(shopProfileService.snapshotSummary(marketplace, batchDate, sellerName, minProductCount, limit));
    }

    @GetMapping("/positioning")
    @Operation(summary = "店铺基线定位", description = "基于 shop_profile_snapshot 与基线成员计算店铺相似度")
    public Result<List<ShopProfilePositioningResult>> positioning(
            @RequestParam String baselineCode,
            @RequestParam String marketplace,
            @RequestParam(required = false) String batchDate,
            @RequestParam(required = false) String sellerName,
            @RequestParam(defaultValue = "100") Integer limit) {
        return Result.success(shopProfileService.positioning(baselineCode, marketplace, batchDate, sellerName, limit));
    }

    @PostMapping("/positioning/compute")
    @Operation(summary = "物化店铺基线定位", description = "写入 shop_profile_positioning_result；执行前需先运行 SQL 并调用店铺画像 compute")
    public Result<ShopProfilePositioningComputeResult> computePositioning(
            @RequestParam String baselineCode,
            @RequestParam String marketplace,
            @RequestParam(required = false) String batchDate) {
        return Result.success(shopProfileService.computePositioning(baselineCode, marketplace, batchDate));
    }

    @GetMapping("/{marketplace}/{sellerName}")
    @Operation(summary = "单店画像详情", description = "返回单店摘要和类目结构")
    public Result<ShopProfileDetail> detail(
            @PathVariable String marketplace,
            @PathVariable String sellerName,
            @RequestParam(required = false) String batchDate) {
        return Result.success(shopProfileService.detail(marketplace, sellerName, batchDate));
    }

    @GetMapping("/{marketplace}/{sellerName}/positioning")
    @Operation(summary = "单店基线定位详情", description = "查看单店与指定店铺基线的结构相似度")
    public Result<ShopProfilePositioningResult> positioningDetail(
            @PathVariable String marketplace,
            @PathVariable String sellerName,
            @RequestParam String baselineCode,
            @RequestParam(required = false) String batchDate) {
        return Result.success(shopProfileService.positioningDetail(marketplace, sellerName, baselineCode, batchDate));
    }

    @GetMapping("/{marketplace}/{sellerName}/products")
    @Operation(summary = "单店商品明细", description = "按销量等级和类目查看 ASIN、链接、榜单类目")
    public Result<PageResult<ShopProfileProduct>> products(
            @PathVariable String marketplace,
            @PathVariable String sellerName,
            @RequestParam(required = false) String batchDate,
            @RequestParam(required = false) String salesTier,
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "60") Integer size) {
        return Result.success(shopProfileService.products(marketplace, sellerName, batchDate, salesTier, category, page, size));
    }

    @GetMapping("/{marketplace}/{sellerName}/categories")
    @Operation(summary = "单店类目结构", description = "按销量等级聚合榜单末级类目")
    public Result<List<ShopProfileCategory>> categories(
            @PathVariable String marketplace,
            @PathVariable String sellerName,
            @RequestParam(required = false) String batchDate,
            @RequestParam(required = false) String salesTier) {
        return Result.success(shopProfileService.categories(marketplace, sellerName, batchDate, salesTier));
    }
}
