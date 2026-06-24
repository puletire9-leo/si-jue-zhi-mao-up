package com.sjzm.product.controller;

import com.sjzm.common.Result;
import com.sjzm.product.service.CategoryBaselineService;
import com.sjzm.product.service.SalesBaselineService;
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
    private final SalesBaselineService salesBaselineService;

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

    @PostMapping("/compute-bsr")
    @Operation(summary = "计算 ①线大类 BSR 基线", description = "按 marketplace × bsr_id × bsr_bucket 计算销量基线")
    public Result<Map<String, Object>> computeBsr(
            @RequestParam(required = false) String marketplace,
            @RequestParam(required = false) String month) {
        return Result.success(salesBaselineService.computeBsrBaseline(month, marketplace));
    }

    @GetMapping("/bsr-health")
    @Operation(summary = "查询 ①线大类 BSR 基线", description = "传入 marketplace + bsrId + bsr，自动命中对应 BSR 分桶")
    public Result<Map<String, Object>> getBsrHealth(
            @RequestParam String marketplace,
            @RequestParam(required = false, name = "bsrId") String bsrId,
            @RequestParam(required = false, name = "bsr_id") String bsrIdSnake,
            @RequestParam Integer bsr,
            @RequestParam(required = false) String month) {
        return Result.success(salesBaselineService.getBsrHealth(
                marketplace,
                firstNonBlank(bsrId, bsrIdSnake),
                bsr,
                month
        ));
    }

    @PostMapping("/compute-subcategory")
    @Operation(summary = "计算 ①线赢家小类基线", description = "只对 ③线赢家覆盖的小类生成销量基线")
    public Result<Map<String, Object>> computeSubcategory(
            @RequestParam(required = false) String marketplace,
            @RequestParam(required = false) String month) {
        return Result.success(salesBaselineService.computeSubcategoryBaseline(month, marketplace));
    }

    @GetMapping("/subcategory-health")
    @Operation(summary = "查询 ①线赢家小类基线", description = "按 marketplace + subCategory 查询小类销量基线")
    public Result<Map<String, Object>> getSubcategoryHealth(
            @RequestParam String marketplace,
            @RequestParam(required = false, name = "subCategory") String subCategory,
            @RequestParam(required = false, name = "sub_category") String subCategorySnake,
            @RequestParam(required = false) String month) {
        return Result.success(salesBaselineService.getSubcategoryHealth(
                marketplace,
                firstNonBlank(subCategory, subCategorySnake),
                month
        ));
    }

    private static String firstNonBlank(String primary, String secondary) {
        if (primary != null && !primary.isBlank()) {
            return primary;
        }
        if (secondary != null && !secondary.isBlank()) {
            return secondary;
        }
        return null;
    }
}
