package com.sjzm.product.controller;

import com.sjzm.common.PageResult;
import com.sjzm.common.Result;
import com.sjzm.product.dto.CompetitorLookupRequest;
import com.sjzm.product.dto.CompetitorProductResponse;
import com.sjzm.product.dto.CompetitorQueryRequest;
import com.sjzm.product.service.CompetitorService;
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

    @PostMapping("/lookup")
    @Operation(summary = "查询竞品数据（调用卖家精灵 API 并入库）")
    public Result<List<CompetitorProductResponse>> lookup(@Valid @RequestBody CompetitorLookupRequest request) {
        List<CompetitorProductResponse> results = competitorService.lookupAndSave(request);
        return Result.success("查询成功，共 " + results.size() + " 条", results);
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

    @GetMapping("/{asin}/history")
    @Operation(summary = "查询某ASIN的历史趋势")
    public Result<List<CompetitorProductResponse>> history(
            @PathVariable String asin,
            @RequestParam(defaultValue = "US") String marketplace) {
        return Result.success(competitorService.getHistory(marketplace, asin));
    }

    @GetMapping("/quota")
    @Operation(summary = "查询 API 用量配额")
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

    @GetMapping("/created-weeks")
    @Operation(summary = "获取商品入库周次列表（选品模式筛选用）")
    public Result<List<String>> createdWeeks(
            @RequestParam(defaultValue = "UK") String marketplace,
            @RequestParam String month) {
        return Result.success(competitorService.getCreatedWeeks(marketplace, month));
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
    @Operation(summary = "修改 API 配额上限")
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
