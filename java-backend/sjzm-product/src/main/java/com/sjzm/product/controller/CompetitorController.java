package com.sjzm.product.controller;

import com.sjzm.common.PageResult;
import com.sjzm.common.Result;
import com.sjzm.product.dto.CompetitorLookupRequest;
import com.sjzm.product.dto.CompetitorProductResponse;
import com.sjzm.product.dto.CompetitorQueryRequest;
import com.sjzm.product.service.CompetitorService;
import com.sjzm.product.modules.requestcenter.entity.SellerspriteRequestRun;
import com.sjzm.product.modules.requestcenter.service.SellerspriteRequestCenterService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import com.sjzm.product.service.ApiRateLimitService;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/competitor")
@RequiredArgsConstructor
@Tag(name = "竞品数据", description = "卖家精灵 API 竞品查询")
public class CompetitorController {

    private final CompetitorService competitorService;
    private final ApiRateLimitService rateLimitService;
    private final SellerspriteRequestCenterService requestCenterService;

    @PostMapping("/lookup")
    @Operation(summary = "创建手动竞品查询任务", description = "异步返回请求中心 runId，不在 HTTP 请求线程调用卖家精灵")
    public Result<Map<String, Object>> lookup(@Valid @RequestBody CompetitorLookupRequest request) {
        SellerspriteRequestRun run = requestCenterService.createManualAsinTask(request, "MANUAL_API");
        return Result.success(Map.of("runId", run.getRunId(), "status", run.getStatus()));
    }

    @GetMapping("/products")
    @Operation(summary = "从本地数据库查询竞品数据（GET）")
    public Result<PageResult<CompetitorProductResponse>> getProducts(@Valid CompetitorQueryRequest request) {
        return Result.success(competitorService.queryFromDb(request));
    }

    @PostMapping("/products")
    @Operation(summary = "从本地数据库查询竞品数据（POST）")
    public Result<PageResult<CompetitorProductResponse>> queryProducts(@RequestBody CompetitorQueryRequest request) {
        return Result.success(competitorService.queryFromDb(request));
    }

    @PostMapping("/premium-products")
    @Operation(summary = "查询精品独立表", description = "复用统一选品筛选能力，固定读取 premium_products 原始数据")
    public Result<PageResult<CompetitorProductResponse>> queryPremiumProducts(
            @RequestBody CompetitorQueryRequest request) {
        return Result.success(competitorService.queryPremiumFromDb(request));
    }

    @GetMapping("/{asin}/history")
    @Operation(summary = "查询某ASIN的历史趋势")
    public Result<List<CompetitorProductResponse>> history(
            @PathVariable String asin,
            @RequestParam(defaultValue = "US") String marketplace) {
        return Result.success(competitorService.getHistory(marketplace, asin));
    }

    @GetMapping("/quota")
    @Operation(summary = "查询卖家精灵使用次数")
    public Result<Map<String, Object>> quota() {
        return Result.success(rateLimitService.getQuotaInfo());
    }

    @GetMapping("/variants")
    @Operation(summary = "查询某父ASIN下的所有变体")
    public Result<List<CompetitorProductResponse>> variants(
            @RequestParam String marketplace,
            @RequestParam String parentAsin) {
        return Result.success(competitorService.getVariants(marketplace, parentAsin));
    }

    @GetMapping("/premium-variants")
    @Operation(summary = "查询精品父 ASIN 下的所有变体")
    public Result<List<CompetitorProductResponse>> premiumVariants(
            @RequestParam String marketplace,
            @RequestParam String parentAsin) {
        return Result.success(competitorService.getPremiumVariants(marketplace, parentAsin));
    }

    @GetMapping("/created-weeks")
    @Operation(summary = "获取入库批次列表（按 created_at 实时计算 ISO 周 + 每周条数，第一条为最新批次）")
    public Result<List<Map<String, Object>>> createdWeeks(
            @RequestParam(defaultValue = "UK") String marketplace,
            @RequestParam(required = false) String source,
            @RequestParam(required = false) String filterMode,
            @RequestParam(defaultValue = "false") boolean useCleanTable) {
        return Result.success(competitorService.getCreatedWeeks(marketplace, source, filterMode, useCleanTable));
    }

    @GetMapping("/premium-created-weeks")
    @Operation(summary = "获取精品入库周批次")
    public Result<List<Map<String, Object>>> premiumCreatedWeeks(
            @RequestParam(defaultValue = "UK") String marketplace) {
        return Result.success(competitorService.getPremiumCreatedWeeks(marketplace));
    }

    @GetMapping("/premium-categories")
    @Operation(summary = "获取精品大类及商品数量")
    public Result<List<Map<String, Object>>> premiumCategories(
            @RequestParam(defaultValue = "UK") String marketplace) {
        return Result.success(competitorService.getPremiumCategories(marketplace));
    }

    @GetMapping("/premium-sellers")
    @Operation(summary = "获取精品卖家列表")
    public Result<List<Map<String, Object>>> premiumSellers(
            @RequestParam(defaultValue = "UK") String marketplace) {
        return Result.success(competitorService.getPremiumSellers(marketplace));
    }

    @GetMapping("/stats")
    @Operation(summary = "数据库统计概览")
    public Result<Map<String, Object>> stats() {
        Map<String, Object> stats = new java.util.LinkedHashMap<>();
        stats.put("products", competitorService.getProductCount());
        stats.put("skipAsins", competitorService.getSkipAsinCount());
        stats.put("shops", competitorService.getShopCount());
        return Result.success(stats);
    }

    @PutMapping("/quota")
    @Operation(summary = "修改卖家精灵使用次数上限")
    public Result<Map<String, Object>> updateQuota(@RequestBody Map<String, Object> body) {
        if (body.containsKey("maxPerMinute")) {
            rateLimitService.updateMaxPerMinute(((Number) body.get("maxPerMinute")).intValue());
        }
        if (body.containsKey("maxPerMonth")) {
            rateLimitService.updateMaxPerMonth(((Number) body.get("maxPerMonth")).intValue());
        }
        if (body.containsKey("maxAsinsPerRequest")) {
            rateLimitService.updateMaxAsinsPerRequest(((Number) body.get("maxAsinsPerRequest")).intValue());
        }
        return Result.success(rateLimitService.getQuotaInfo());
    }
}
