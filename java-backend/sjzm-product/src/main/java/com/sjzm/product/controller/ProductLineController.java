 package com.sjzm.product.controller;

import com.sjzm.common.Result;
import com.sjzm.product.entity.ProductLineGuidance;
import com.sjzm.product.service.ProductLineGuidanceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 品线选品指导意见控制器。
 *
 * 3个端点:
 * 1. GET  /api/v1/product-line/aggregated-data  — 聚合数据（Agent data_fetch 调用）
 * 2. POST /api/v1/product-line/analysis-results — 回写分析结果（Agent 完成后调用）
 * 3. GET  /api/v1/product-line/guidance         — 查询品线指导意见（前端展示）
 */
@RestController
@RequestMapping("/api/v1/product-line")
@RequiredArgsConstructor
@Tag(name = "品线选品", description = "品线选品指导意见")
public class ProductLineController {

    private final ProductLineGuidanceService guidanceService;

    /**
     * 聚合品线数据 — 从 deng_zong_shop 按 marketplace+month 两级聚合。
     * 返回 L1品线(bsr_id) → L2小类(node_id) → 样本商品 的树形结构。
     *
     * @param marketplace 站点 UK/DE
     * @param month       数据月份 如 202605
     */
    @GetMapping("/aggregated-data")
    @Operation(summary = "聚合品线数据", description = "从deng_zong_shop按bsr_id/node_id两级聚合，供Agent分析")
    public Result<Map<String, Object>> getAggregatedData(
            @RequestParam(defaultValue = "UK") String marketplace,
            @RequestParam String month) {
        Map<String, Object> data = guidanceService.aggregateData(marketplace, month);
        return Result.success(data);
    }

    /**
     * 回写分析结果 — Agent 分析完成后调用。
     *
     * @param body {"batchId": "...", "results": [{bsrId, archetype, lifecycleStage, ...}, ...]}
     */
    @PostMapping("/analysis-results")
    @Operation(summary = "回写分析结果", description = "保存Agent分析结果到品线指导意见表")
    @SuppressWarnings("unchecked")
    public Result<Map<String, Object>> saveAnalysisResults(
            @RequestBody Map<String, Object> body) {
        String batchId = (String) body.getOrDefault("batchId", "");
        List<Map<String, Object>> results = (List<Map<String, Object>>) body.getOrDefault("results", List.of());

        Map<String, Object> saved = guidanceService.saveAnalysisResults(batchId, results);
        return Result.success("分析结果保存成功", saved);
    }

    /**
     * 查询品线指导意见 — 前端展示。
     *
     * @param batchId 批次ID（可选）
     * @param bsrId   BSR节点ID（可选，精确查询单品线）
     */
    @GetMapping("/guidance")
    @Operation(summary = "查询品线指导", description = "查询已保存的品线选品指导意见")
    public Result<List<ProductLineGuidance>> getGuidance(
            @RequestParam(required = false) String batchId,
            @RequestParam(required = false) String bsrId) {
        List<ProductLineGuidance> list = guidanceService.queryGuidance(batchId, bsrId);
        return Result.success(list);
    }
}
