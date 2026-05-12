package com.sjzm.controller;

import com.sjzm.common.BusinessException;
import com.sjzm.common.Result;
import com.sjzm.service.ProductDataService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 产品数据控制器（对齐 Python 的 /product-data）
 */
@Slf4j
@Tag(name = "产品数据看板", description = "产品数据统计、销售趋势、TOP产品等数据看板功能")
@RestController
@RequestMapping("/api/v1/product-data")
@RequiredArgsConstructor
public class ProductDataController {

    private final ProductDataService productDataService;

    @Operation(summary = "获取可用月份", description = "获取所有可用的数据月份列表")
    @GetMapping("/available-months")
    public Result<List<String>> getAvailableMonths() {
        try {
            List<String> result = productDataService.getAvailableMonths();
            return Result.success(result);
        } catch (Exception e) {
            throw new BusinessException("获取可用月份失败: " + e.getMessage());
        }
    }

    @Operation(summary = "获取分类统计", description = "获取分类统计数据")
    @GetMapping("/category-stats")
    public Result<Map<String, Object>> getCategoryStats(
            @Parameter(description = "开始日期") @RequestParam(required = false) String start_date,
            @Parameter(description = "结束日期") @RequestParam(required = false) String end_date,
            @Parameter(description = "月份") @RequestParam(required = false) String month,
            @Parameter(description = "店铺") @RequestParam(required = false) String store,
            @Parameter(description = "国家") @RequestParam(required = false) String country,
            @Parameter(description = "开发者") @RequestParam(required = false) String developer) {
        try {
            Map<String, Object> result = productDataService.getCategoryStats(
                    start_date, end_date, month, store, country, developer);
            return Result.success(result);
        } catch (Exception e) {
            throw new BusinessException("获取分类统计失败: " + e.getMessage());
        }
    }

    @Operation(summary = "获取产品列表", description = "分页获取产品明细列表")
    @GetMapping("/products")
    public Result<Map<String, Object>> getProducts(
            @Parameter(description = "页码") @RequestParam(defaultValue = "1") int page,
            @Parameter(description = "每页数量") @RequestParam(defaultValue = "20") int size,
            @Parameter(description = "开始日期") @RequestParam(required = false) String start_date,
            @Parameter(description = "结束日期") @RequestParam(required = false) String end_date,
            @Parameter(description = "店铺") @RequestParam(required = false) String store,
            @Parameter(description = "国家") @RequestParam(required = false) String country,
            @Parameter(description = "分类") @RequestParam(required = false) String category,
            @Parameter(description = "月份") @RequestParam(required = false) String month,
            @Parameter(description = "开发者") @RequestParam(required = false) String developer,
            @Parameter(description = "搜索关键词") @RequestParam(required = false) String search_keyword,
            @Parameter(description = "排序字段") @RequestParam(defaultValue = "sales_amount") String sort_field,
            @Parameter(description = "排序顺序") @RequestParam(defaultValue = "desc") String sort_order) {
        try {
            Map<String, Object> result = productDataService.getProducts(
                    page, size, start_date, end_date, store, country, category, month,
                    developer, search_keyword, sort_field, sort_order);
            return Result.success(result);
        } catch (Exception e) {
            throw new BusinessException("获取产品列表失败: " + e.getMessage());
        }
    }

    @Operation(summary = "导出产品数据", description = "导出产品数据为CSV文件")
    @GetMapping("/export")
    public ResponseEntity<ByteArrayResource> exportProducts(
            @Parameter(description = "开始日期") @RequestParam(required = false) String start_date,
            @Parameter(description = "结束日期") @RequestParam(required = false) String end_date,
            @Parameter(description = "店铺") @RequestParam(required = false) String store,
            @Parameter(description = "国家") @RequestParam(required = false) String country,
            @Parameter(description = "分类") @RequestParam(required = false) String category,
            @Parameter(description = "月份") @RequestParam(required = false) String month,
            @Parameter(description = "开发者") @RequestParam(required = false) String developer,
            @Parameter(description = "搜索关键词") @RequestParam(required = false) String search_keyword) {
        try {
            byte[] data = productDataService.exportProducts(
                    start_date, end_date, store, country, category, month, developer, search_keyword);
            String filename = "product_data_" + (start_date != null ? start_date : month != null ? month : "all") + ".csv";
            ByteArrayResource resource = new ByteArrayResource(data);
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType("text/csv"));
            headers.setContentDisposition(ContentDisposition.builder("attachment").filename(filename).build());
            return ResponseEntity.ok().headers(headers).body(resource);
        } catch (Exception e) {
            throw new BusinessException("导出产品数据失败: " + e.getMessage());
        }
    }

    @Operation(summary = "获取销售趋势", description = "获取销售趋势图数据")
    @GetMapping("/sales-trend")
    public Result<Map<String, Object>> getSalesTrend(
            @Parameter(description = "开始日期") @RequestParam(required = false) String start_date,
            @Parameter(description = "结束日期") @RequestParam(required = false) String end_date,
            @Parameter(description = "时间维度") @RequestParam(defaultValue = "day") String time_dimension,
            @Parameter(description = "月份数") @RequestParam(defaultValue = "6") int months,
            @Parameter(description = "分类") @RequestParam(required = false) String category,
            @Parameter(description = "店铺") @RequestParam(required = false) String store,
            @Parameter(description = "国家") @RequestParam(required = false) String country,
            @Parameter(description = "开发者") @RequestParam(required = false) String developer) {
        try {
            Map<String, Object> result = productDataService.getSalesTrend(
                    start_date, end_date, time_dimension, months, category, store, country, developer);
            return Result.success(result);
        } catch (Exception e) {
            throw new BusinessException("获取销售趋势失败: " + e.getMessage());
        }
    }

    @Operation(summary = "获取TOP产品", description = "获取销售TOP产品列表")
    @GetMapping("/top-products")
    public Result<Map<String, Object>> getTopProducts(
            @Parameter(description = "开始日期") @RequestParam(required = false) String start_date,
            @Parameter(description = "结束日期") @RequestParam(required = false) String end_date,
            @Parameter(description = "返回数量") @RequestParam(defaultValue = "10") int limit,
            @Parameter(description = "分类") @RequestParam(required = false) String category,
            @Parameter(description = "店铺") @RequestParam(required = false) String store,
            @Parameter(description = "国家") @RequestParam(required = false) String country,
            @Parameter(description = "开发者") @RequestParam(required = false) String developer) {
        try {
            Map<String, Object> result = productDataService.getTopProducts(
                    start_date, end_date, limit, category, store, country, developer);
            return Result.success(result);
        } catch (Exception e) {
            throw new BusinessException("获取TOP产品失败: " + e.getMessage());
        }
    }

    @Operation(summary = "获取筛选选项", description = "动态获取筛选列表选项")
    @GetMapping("/filter-options")
    public Result<Map<String, Object>> getFilterOptions() {
        try {
            Map<String, Object> result = productDataService.getFilterOptions();
            return Result.success(result);
        } catch (Exception e) {
            throw new BusinessException("获取筛选选项失败: " + e.getMessage());
        }
    }

    @Operation(summary = "获取广告表现", description = "获取广告表现数据")
    @GetMapping("/ad-performance")
    public Result<Map<String, Object>> getAdPerformance(
            @Parameter(description = "开始日期") @RequestParam(required = false) String start_date,
            @Parameter(description = "结束日期") @RequestParam(required = false) String end_date,
            @Parameter(description = "分类") @RequestParam(required = false) String category,
            @Parameter(description = "店铺") @RequestParam(required = false) String store,
            @Parameter(description = "国家") @RequestParam(required = false) String country,
            @Parameter(description = "开发者") @RequestParam(required = false) String developer) {
        try {
            Map<String, Object> result = productDataService.getAdPerformance(
                    start_date, end_date, category, store, country, developer);
            return Result.success(result);
        } catch (Exception e) {
            throw new BusinessException("获取广告表现失败: " + e.getMessage());
        }
    }

    @Operation(summary = "清除缓存", description = "清除产品数据相关的缓存")
    @PostMapping("/clear-cache")
    public Result<Map<String, Object>> clearCache() {
        try {
            Map<String, Object> result = productDataService.clearCache();
            return Result.success(result);
        } catch (Exception e) {
            throw new BusinessException("清除缓存失败: " + e.getMessage());
        }
    }

    @Operation(summary = "对比数据", description = "获取本期和对比期的完整数据对比")
    @GetMapping("/compare-data")
    public Result<Map<String, Object>> getCompareData(
            @Parameter(description = "本期开始日期") @RequestParam(required = false) String current_start_date,
            @Parameter(description = "本期结束日期") @RequestParam(required = false) String current_end_date,
            @Parameter(description = "对比期开始日期") @RequestParam(required = false) String compare_start_date,
            @Parameter(description = "对比期结束日期") @RequestParam(required = false) String compare_end_date,
            @Parameter(description = "分类") @RequestParam(required = false) String category,
            @Parameter(description = "店铺") @RequestParam(required = false) String store,
            @Parameter(description = "国家") @RequestParam(required = false) String country,
            @Parameter(description = "开发者") @RequestParam(required = false) String developer) {
        try {
            Map<String, Object> result = productDataService.getCompareData(
                    current_start_date, current_end_date,
                    compare_start_date, compare_end_date,
                    category, store, country, developer);
            return Result.success(result);
        } catch (Exception e) {
            throw new BusinessException("获取对比数据失败: " + e.getMessage());
        }
    }
}
