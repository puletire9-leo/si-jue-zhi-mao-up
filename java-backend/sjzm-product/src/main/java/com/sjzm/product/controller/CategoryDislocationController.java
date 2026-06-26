package com.sjzm.product.controller;

import com.sjzm.common.Result;
import com.sjzm.product.service.CategoryDislocationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/category-dislocation")
@RequiredArgsConstructor
@Tag(name = "错位机会", description = "②线小类错位机会信号")
public class CategoryDislocationController {

    private final CategoryDislocationService categoryDislocationService;

    @PostMapping("/compute")
    @Operation(summary = "计算 ②线错位机会", description = "按 marketplace + month 计算 category_dislocation")
    public Result<Map<String, Object>> compute(
            @RequestParam(required = false) String marketplace,
            @RequestParam(required = false) String month) {
        return Result.success(categoryDislocationService.computeDislocation(month, marketplace));
    }

    @GetMapping("/health")
    @Operation(summary = "查询 ②线错位信号", description = "传入 marketplace + subCategory，返回对应小类的错位分与 heat_signal")
    public Result<Map<String, Object>> health(
            @RequestParam String marketplace,
            @RequestParam(required = false, name = "subCategory") String subCategory,
            @RequestParam(required = false, name = "sub_category") String subCategorySnake,
            @RequestParam(required = false) String month) {
        return Result.success(categoryDislocationService.getSignalHealth(
                marketplace,
                firstNonBlank(subCategory, subCategorySnake),
                month
        ));
    }

    @GetMapping("/opportunities")
    @Operation(summary = "列出 ②线错位机会清单", description = "按 heat_signal 拉取当前 month 的小类错位机会列表，默认 GREEN")
    public Result<Map<String, Object>> opportunities(
            @RequestParam String marketplace,
            @RequestParam(required = false) String month,
            @RequestParam(required = false, name = "heatSignal") String heatSignal,
            @RequestParam(required = false, name = "heat_signal") String heatSignalSnake,
            @RequestParam(defaultValue = "20") int limit) {
        return Result.success(categoryDislocationService.listOpportunities(
                marketplace,
                month,
                firstNonBlank(heatSignal, heatSignalSnake),
                limit
        ));
    }

    @GetMapping("/actionable-opportunities")
    @Operation(summary = "列出 ③×② 可行动机会", description = "只返回我们历史上赢过、且当前存在错位信号的小类方向")
    public Result<Map<String, Object>> actionableOpportunities(
            @RequestParam String marketplace,
            @RequestParam(required = false) String month,
            @RequestParam(required = false, name = "heatSignal") String heatSignal,
            @RequestParam(required = false, name = "heat_signal") String heatSignalSnake,
            @RequestParam(defaultValue = "20") int limit) {
        return Result.success(categoryDislocationService.listActionableOpportunities(
                marketplace,
                month,
                firstNonBlank(heatSignal, heatSignalSnake),
                limit
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
