package com.sjzm.product.controller;

import com.sjzm.common.Result;
import com.sjzm.product.entity.ProductPerformanceActual;
import com.sjzm.product.service.ProductPerformanceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/product-performance")
@RequiredArgsConstructor
@Tag(name = "自有战绩", description = "591 赢家导入与查询")
public class ProductPerformanceController {

    private final ProductPerformanceService productPerformanceService;

    @PostMapping("/import")
    @Operation(summary = "导入真实战绩", description = "从 Markdown 表格导入 product_performance_actual")
    public Result<Map<String, Object>> importMarkdown(
            @RequestParam(defaultValue = "docs/选品方法库/产品表现ASIN_转换版2.md") String filePath) {
        int imported = productPerformanceService.importFromMarkdown(filePath);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("filePath", filePath);
        data.put("imported", imported);
        data.put("total", productPerformanceService.count());
        return Result.success("导入完成", data);
    }

    @GetMapping("/winners")
    @Operation(summary = "查询赢家", description = "按站点查询真实赢家列表")
    public Result<List<ProductPerformanceActual>> winners(
            @RequestParam(required = false) String marketplace) {
        return Result.success(productPerformanceService.listWinners(marketplace));
    }

    @GetMapping("/by-archetype")
    @Operation(summary = "按原型查询", description = "按 STD/CUSTOM 查询真实赢家")
    public Result<List<ProductPerformanceActual>> byArchetype(
            @RequestParam String archetype) {
        return Result.success(productPerformanceService.listByArchetype(archetype));
    }

    @GetMapping("/count")
    @Operation(summary = "总数统计", description = "查询真实战绩总行数")
    public Result<Long> count() {
        return Result.success(productPerformanceService.count());
    }
}
