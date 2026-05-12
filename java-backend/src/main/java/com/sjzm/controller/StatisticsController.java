package com.sjzm.controller;

import com.sjzm.common.BusinessException;
import com.sjzm.common.Result;
import com.sjzm.service.StatisticsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 统计分析控制器
 */
@Slf4j
@Tag(name = "统计分析", description = "仪表板统计、图片趋势、存储统计、用户活动等")
@RestController
@RequestMapping("/api/v1/statistics")
@RequiredArgsConstructor
public class StatisticsController {

    private final StatisticsService statisticsService;

    @Operation(summary = "仪表板统计", description = "获取仪表板统计数据（各模块数量）")
    @GetMapping("/dashboard")
    public Result<Map<String, Object>> getDashboardStats() {
        try {
            Map<String, Object> result = statisticsService.getDashboardStats();
            return Result.success(result);
        } catch (Exception e) {
            throw new BusinessException("获取仪表板统计失败: " + e.getMessage());
        }
    }

    @Operation(summary = "图片趋势", description = "获取指定天数内的图片上传趋势")
    @GetMapping("/image-trend")
    public Result<Map<String, Object>> getImageTrend(
            @Parameter(description = "天数") @RequestParam(defaultValue = "30") int days) {
        try {
            Map<String, Object> result = statisticsService.getImageTrend(days);
            return Result.success(result);
        } catch (Exception e) {
            throw new BusinessException("获取图片趋势失败: " + e.getMessage());
        }
    }

    @Operation(summary = "存储统计", description = "获取存储使用统计")
    @GetMapping("/storage")
    public Result<Map<String, Object>> getStorageStats() {
        try {
            Map<String, Object> result = statisticsService.getStorageStats();
            return Result.success(result);
        } catch (Exception e) {
            throw new BusinessException("获取存储统计失败: " + e.getMessage());
        }
    }

    @Operation(summary = "用户活动", description = "获取用户活动统计")
    @GetMapping("/user-activity")
    public Result<Map<String, Object>> getUserActivity(
            @Parameter(description = "天数") @RequestParam(defaultValue = "30") int days) {
        try {
            Map<String, Object> result = statisticsService.getUserActivity(days);
            return Result.success(result);
        } catch (Exception e) {
            throw new BusinessException("获取用户活动统计失败: " + e.getMessage());
        }
    }

    @Operation(summary = "图片质量统计", description = "获取图片质量分类统计")
    @GetMapping("/image-quality")
    public Result<Map<String, Object>> getImageQualityStats() {
        try {
            Map<String, Object> result = statisticsService.getImageQualityStats();
            return Result.success(result);
        } catch (Exception e) {
            throw new BusinessException("获取图片质量统计失败: " + e.getMessage());
        }
    }

    @Operation(summary = "产品类型统计", description = "获取产品类型分布统计")
    @GetMapping("/product-types")
    public Result<Map<String, Object>> getProductTypeStats() {
        try {
            Map<String, Object> result = statisticsService.getProductTypeStats();
            return Result.success(result);
        } catch (Exception e) {
            throw new BusinessException("获取产品类型统计失败: " + e.getMessage());
        }
    }

    @Operation(summary = "选品等级统计", description = "获取选品等级分布统计")
    @GetMapping("/selection-grades")
    public Result<Map<String, Object>> getSelectionGradeStats() {
        try {
            Map<String, Object> result = statisticsService.getSelectionGradeStats();
            return Result.success(result);
        } catch (Exception e) {
            throw new BusinessException("获取选品等级统计失败: " + e.getMessage());
        }
    }
}
