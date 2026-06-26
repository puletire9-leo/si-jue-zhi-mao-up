package com.sjzm.product.controller;

import com.sjzm.common.Result;
import com.sjzm.product.service.BlueOceanDataService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 蓝海扫描数据 API — 供 selection-agent 查询和回写。
 * 端点: /api/v1/blue-ocean/*
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/blue-ocean")
@RequiredArgsConstructor
@Tag(name = "蓝海扫描数据", description = "品类聚合、商品列表、扫描结果回写")
public class BlueOceanController {

    private final BlueOceanDataService blueOceanDataService;

    /**
     * 全品类10维聚合数据。
     * selection-agent 调用: GET /api/v1/blue-ocean/category-aggregation
     */
    @GetMapping("/category-aggregation")
    @Operation(summary = "全品类10维聚合数据")
    public Result<List<Map<String, Object>>> getCategoryAggregation(
            @RequestParam String marketplace,
            @RequestParam String month
    ) {
        List<Map<String, Object>> data = blueOceanDataService.getCategoryAggregation(marketplace, month);
        return Result.success(data);
    }

    /**
     * 单品类商品列表。
     * selection-agent 调用: GET /api/v1/blue-ocean/category-products
     */
    @GetMapping("/category-products")
    @Operation(summary = "单品类商品列表")
    public Result<List<Map<String, Object>>> getCategoryProducts(
            @RequestParam String marketplace,
            @RequestParam String month,
            @RequestParam String category
    ) {
        List<Map<String, Object>> data = blueOceanDataService.getCategoryProducts(marketplace, month, category);
        return Result.success(data);
    }

    /**
     * 回写蓝海扫描结果。
     * selection-agent 调用: POST /api/v1/blue-ocean/scan-results
     */
    @PostMapping("/scan-results")
    @Operation(summary = "回写蓝海扫描结果")
    public Result<Map<String, Object>> saveScanResults(
            @RequestBody Map<String, Object> body
    ) {
        Map<String, Object> result = blueOceanDataService.saveScanResults(body);
        return Result.success(result);
    }
}
