package com.sjzm.product.controller;

import com.sjzm.common.Result;
import com.sjzm.product.service.CategoryBaselineService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 品类基线控制器 — 选品Agent final_verdict 节点调用。
 *
 * GET /api/v1/category-baseline/health — 查询品类百分位基线（P25/P50/P75）
 */
@RestController
@RequestMapping("/api/v1/category-baseline")
@RequiredArgsConstructor
@Tag(name = "品类基线", description = "品类百分位基线数据，供Agent评分校准")
public class CategoryBaselineController {

    private final CategoryBaselineService baselineService;

    /**
     * 查询品类基线百分位数据。
     *
     * @param marketplace   站点 UK/DE/US
     * @param categoryLabel 品类名称（如 "Nail Tips"）
     * @param month         基线月份（可选，默认取最新）
     * @return 基线数据（含8维百分位和健康度），数据不足时 hasBaseline=false
     */
    @GetMapping("/health")
    @Operation(summary = "品类基线查询", description = "返回品类8维P25/P50/P75百分位和健康度")
    public Result<Map<String, Object>> getHealth(
            @RequestParam String marketplace,
            @RequestParam String categoryLabel,
            @RequestParam(required = false) String month) {
        Map<String, Object> data = baselineService.getBaseline(marketplace, categoryLabel, month);
        return Result.success(data);
    }

    /**
     * 从 competitor_products 重新计算品类百分位基线。
     *
     * @param marketplace 站点 UK/DE/US
     * @param month       数据月份 如 2026-06
     * @return 计算摘要（总产品数、品类数、写入数、跳过数等）
     */
    @PostMapping("/compute")
    @Operation(summary = "计算品类基线", description = "从competitor_products重新计算品类百分位基线")
    public Result<Map<String, Object>> compute(
            @RequestParam String marketplace,
            @RequestParam String month) {
        Map<String, Object> result = baselineService.computeBaseline(marketplace, month);
        return Result.success(result);
    }
}
