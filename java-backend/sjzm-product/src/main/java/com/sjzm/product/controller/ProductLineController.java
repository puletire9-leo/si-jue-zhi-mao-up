 package com.sjzm.product.controller;

import com.sjzm.common.Result;
import com.sjzm.product.entity.ProductLineGuidance;
import com.sjzm.product.mapper.CompetitorProductMapper;
import com.sjzm.product.mapper.DengZongShopMapper;
import com.sjzm.product.service.ProductLineGuidanceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

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

    private final CompetitorProductMapper competitorProductMapper;

    private final DengZongShopMapper dengZongShopMapper;

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

    @GetMapping("/all-categories")
    @Operation(summary = "获取全部品类（选品模式用）")
    public Result<Map<String, Object>> getAllCategories(
            @RequestParam(defaultValue = "UK") String marketplace,
            @RequestParam String month) {
        List<Map<String, Object>> l2Rows = competitorProductMapper.countByNodeId(marketplace, month);
        // 郑总对比数据：用 deng_zong_shop 最新月份，不受选品月份限制
        String zhengMo = dengZongShopMapper.selectMaxMonth(marketplace);
        if (zhengMo == null) zhengMo = month;
        // 郑总各子类的商品数映射：composite_key -> count
        Map<String, Integer> zhengCounts = new HashMap<>();
        for (Map<String, Object> row : dengZongShopMapper.selectZhengNodeCounts(marketplace, zhengMo)) {
            String key = (String) row.get("composite_key");
            Integer count = row.get("product_count") instanceof Number
                    ? ((Number) row.get("product_count")).intValue() : 0;
            if (key != null) zhengCounts.put(key, count);
        }
        // 郑总 bsr_id 按数量降序的榜单顺序
        List<Map<String, Object>> zhengBsrOrder = dengZongShopMapper.selectZhengBsrIdsOrdered(marketplace, zhengMo);
        List<String> zhengBsrIdOrder = zhengBsrOrder.stream()
                .map(r -> (String) r.get("bsrId"))
                .collect(Collectors.toList());
        return Result.success(buildProductLines(l2Rows, zhengCounts, zhengBsrIdOrder));
    }

    private static final int MIN_ZENG = 3;

    private Map<String, Object> buildProductLines(
            List<Map<String, Object>> l2Rows,
            Map<String, Integer> zhengCounts,
            List<String> zhengBsrIdOrder) {
        Map<String, List<Map<String, Object>>> grouped = l2Rows.stream()
                .filter(row -> row.get("bsrId") != null)
                .collect(Collectors.groupingBy(row -> (String) row.get("bsrId")));

        List<Map<String, Object>> lines = new ArrayList<>();
        for (Map.Entry<String, List<Map<String, Object>>> entry : grouped.entrySet()) {
            String bsrId = entry.getKey();
            List<Map<String, Object>> children = entry.getValue();
            int totalCount = children.stream()
                    .mapToInt(c -> ((Number) c.get("productCount")).intValue())
                    .sum();
            String bsrName = extractBsrName(children);

            // Sort L2: 郑总商品数降序 → 总商品数降序
            children.sort((a, b) -> {
                int aZc = zhengCounts.getOrDefault(bsrId + "_" + a.get("nodeId"), 0);
                int bZc = zhengCounts.getOrDefault(bsrId + "_" + b.get("nodeId"), 0);
                if (aZc != bZc) return Integer.compare(bZc, aZc);
                int countA = ((Number) a.get("productCount")).intValue();
                int countB = ((Number) b.get("productCount")).intValue();
                return Integer.compare(countB, countA);
            });

            children.forEach(child -> {
                int zc = zhengCounts.getOrDefault(bsrId + "_" + child.get("nodeId"), 0);
                child.put("isZheng", zc >= MIN_ZENG);
            });

            Map<String, Object> line = new LinkedHashMap<>();
            line.put("bsrId", bsrId);
            line.put("bsrName", bsrName);
            line.put("productCount", totalCount);
            line.put("subCategories", children);
            boolean lineHasZheng = children.stream().anyMatch(c ->
                    zhengCounts.getOrDefault(bsrId + "_" + c.get("nodeId"), 0) >= MIN_ZENG);
            line.put("isZheng", lineHasZheng);
            lines.add(line);
        }

        // Sort L1: 郑总按榜单顺序 → 其他按数量降序
        lines.sort((a, b) -> {
            String aId = (String) a.get("bsrId");
            String bId = (String) b.get("bsrId");
            int aIdx = zhengBsrIdOrder.indexOf(aId);
            int bIdx = zhengBsrIdOrder.indexOf(bId);
            if (aIdx >= 0 && bIdx >= 0) return Integer.compare(aIdx, bIdx);
            if (aIdx >= 0) return -1;
            if (bIdx >= 0) return 1;
            int countA = ((Number) a.get("productCount")).intValue();
            int countB = ((Number) b.get("productCount")).intValue();
            return Integer.compare(countB, countA);
        });

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("productLines", lines);
        return result;
    }

    private String extractBsrName(List<Map<String, Object>> children) {
        for (Map<String, Object> c : children) {
            String path = (String) c.get("nodeFullPath");
            if (path != null && !path.isEmpty()) {
                return path.split(":")[0];
            }
        }
        return "";
    }
}
