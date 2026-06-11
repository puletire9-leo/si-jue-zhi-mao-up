package com.sjzm.product.controller;

import com.sjzm.common.Result;
import com.sjzm.product.service.SellerDataService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 卖家数据 API — 供 selection-agent 查询和回写。
 * 端点: /api/v1/seller/*
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/seller")
@RequiredArgsConstructor
@Tag(name = "卖家数据", description = "卖家商品聚合、画像、跟品信号查询与回写")
public class SellerController {

    private final SellerDataService sellerDataService;

    /**
     * 获取全量卖家商品数据，按卖家名分组。
     * selection-agent 调用: GET /api/v1/seller/raw-products
     */
    @GetMapping("/raw-products")
    @Operation(summary = "全量卖家商品（按卖家分组）")
    public Result<Map<String, List<Map<String, Object>>>> getRawProducts(
            @RequestParam String marketplace,
            @RequestParam String month
    ) {
        Map<String, List<Map<String, Object>>> data = sellerDataService.getRawProducts(marketplace, month);
        return Result.success(data);
    }

    /**
     * 按品类查询卖家画像。
     * selection-agent 调用: GET /api/v1/seller/profiles-by-category
     */
    @GetMapping("/profiles-by-category")
    @Operation(summary = "按品类查询卖家画像")
    public Result<List<?>> getProfilesByCategory(
            @RequestParam String marketplace,
            @RequestParam(required = false) String category
    ) {
        var profiles = sellerDataService.getProfilesByCategory(marketplace, category);
        return Result.success(profiles);
    }

    /**
     * 批量写入卖家画像。
     * selection-agent 调用: POST /api/v1/seller/profiles
     */
    @PostMapping("/profiles")
    @Operation(summary = "批量写入卖家画像")
    public Result<Map<String, Object>> saveProfiles(
            @RequestBody Map<String, Object> body
    ) {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> profiles = (List<Map<String, Object>>) body.get("profiles");
        if (profiles == null || profiles.isEmpty()) {
            return Result.error("profiles 不能为空");
        }
        Map<String, Object> result = sellerDataService.saveProfiles(profiles);
        return Result.success(result);
    }

    /**
     * 批量写入跟品信号。
     * selection-agent 调用: POST /api/v1/seller/follow-signals
     */
    @PostMapping("/follow-signals")
    @Operation(summary = "批量写入跟品信号")
    public Result<Map<String, Object>> saveFollowSignals(
            @RequestBody Map<String, Object> body
    ) {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> signals = (List<Map<String, Object>>) body.get("signals");
        if (signals == null || signals.isEmpty()) {
            return Result.error("signals 不能为空");
        }
        Map<String, Object> result = sellerDataService.saveFollowSignals(signals);
        return Result.success(result);
    }

    /**
     * 查询品类热度矩阵。
     * selection-agent 调用: GET /api/v1/seller/heat-matrix
     */
    @GetMapping("/heat-matrix")
    @Operation(summary = "查询品类热度矩阵")
    public Result<List<?>> getHeatMatrix(
            @RequestParam String marketplace,
            @RequestParam(required = false) String month
    ) {
        return Result.success(sellerDataService.getHeatMatrix(marketplace, month));
    }

    /**
     * 写入品类热度矩阵（给 selection-agent monthly scan 使用）。
     */
    @PostMapping("/heat-matrix")
    @Operation(summary = "批量写入品类热度矩阵")
    public Result<Map<String, Object>> saveHeatMatrix(
            @RequestBody Map<String, Object> body
    ) {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> rows = (List<Map<String, Object>>) body.get("rows");
        if (rows == null || rows.isEmpty()) {
            return Result.error("rows 不能为空");
        }
        return Result.success(sellerDataService.saveHeatMatrix(rows));
    }

    /**
     * 查询跟品信号。
     * selection-agent 调用: GET /api/v1/seller/follow-signals
     */
    @GetMapping("/follow-signals")
    @Operation(summary = "查询跟品信号")
    public Result<List<?>> getFollowSignals(
            @RequestParam String marketplace,
            @RequestParam(required = false) String month
    ) {
        return Result.success(sellerDataService.getFollowSignals(marketplace, month));
    }
}
