package com.sjzm.controller;

import com.sjzm.common.Result;
import com.sjzm.dto.*;
import com.sjzm.service.ProductSalesService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
@Tag(name = "产品销量数据", description = "产品销量数据查询API")
public class ProductSalesController {

    private final ProductSalesService productSalesService;

    @GetMapping("/search")
    @Operation(summary = "搜索产品", description = "支持模糊搜索 ASIN、标题、SKU、MSKU，返回最多50个产品，按销量排序")
    public Result<SearchResponse> searchProducts(
            @Parameter(description = "搜索关键词（ASIN/标题/SKU/MSKU）")
            @RequestParam(required = false) String q,
            @Parameter(description = "店铺筛选，逗号分隔")
            @RequestParam(required = false) String shops,
            @Parameter(description = "开始日期 YYYY-MM-DD")
            @RequestParam(required = false) String startDate,
            @Parameter(description = "结束日期 YYYY-MM-DD")
            @RequestParam(required = false) String endDate,
            @Parameter(description = "返回数量限制")
            @RequestParam(defaultValue = "50") int limit,
            @Parameter(description = "分页偏移")
            @RequestParam(defaultValue = "0") int offset
    ) {
        try {
            List<String> shopList = parseShopList(shops);
            SearchResponse response = productSalesService.searchProducts(q, shopList, startDate, endDate, limit, offset);
            return Result.success(response);
        } catch (FileNotFoundError e) {
            return Result.error(500, "数据文件不存在: " + e.getMessage());
        } catch (Exception e) {
            log.error("搜索产品失败", e);
            return Result.error(500, "搜索失败: " + e.getMessage());
        }
    }

    @GetMapping("/weekly")
    @Operation(summary = "获取周销量数据", description = "支持多产品对比（最多100个ASIN），返回每周的销量和销售额")
    public Result<WeeklySalesResponse> getWeeklySales(
            @Parameter(description = "ASIN列表，逗号分隔", required = true)
            @RequestParam String asins,
            @Parameter(description = "开始日期 YYYY-MM-DD")
            @RequestParam(required = false) String startDate,
            @Parameter(description = "结束日期 YYYY-MM-DD")
            @RequestParam(required = false) String endDate,
            @Parameter(description = "店铺筛选，逗号分隔")
            @RequestParam(required = false) String shops
    ) {
        try {
            List<String> asinList = parseAsinList(asins);
            if (asinList.isEmpty()) {
                return Result.error(400, "ASIN参数不能为空");
            }
            if (asinList.size() > 100) {
                return Result.error(400, "最多同时查询100个产品");
            }

            List<String> shopList = parseShopList(shops);
            WeeklySalesResponse response = productSalesService.getWeeklySales(asinList, startDate, endDate, shopList);
            return Result.success(response);
        } catch (Exception e) {
            log.error("获取周销量失败", e);
            return Result.error(500, "获取周销量失败: " + e.getMessage());
        }
    }

    @GetMapping("/shops")
    @Operation(summary = "获取店铺列表", description = "获取所有店铺列表")
    public Result<List<ShopInfo>> getShops() {
        try {
            List<ShopInfo> shops = productSalesService.getShops();
            return Result.success(shops);
        } catch (Exception e) {
            log.error("获取店铺列表失败", e);
            return Result.error(500, "获取店铺列表失败: " + e.getMessage());
        }
    }

    @GetMapping("/date-range")
    @Operation(summary = "获取日期范围", description = "获取数据的日期范围")
    public Result<DateRangeResponse> getDateRange() {
        try {
            DateRangeResponse response = productSalesService.getDateRange();
            return Result.success(response);
        } catch (Exception e) {
            log.error("获取日期范围失败", e);
            return Result.error(500, "获取日期范围失败: " + e.getMessage());
        }
    }

    @PostMapping("/period-comparison")
    @Operation(summary = "双周期数据对比", description = "支持自由选择两个时间周期进行对比，返回销售、利润、广告、退款等完整数据")
    public Result<PeriodComparisonResponse> getPeriodComparison(
            @RequestBody PeriodComparisonRequest request
    ) {
        try {
            if (request.getAsins() == null || request.getAsins().isEmpty()) {
                return Result.error(400, "ASIN列表不能为空");
            }
            if (request.getAsins().size() > 100) {
                return Result.error(400, "最多同时查询100个ASIN");
            }
            if (request.getPeriodA() == null || request.getPeriodA().getStartDate() == null || request.getPeriodA().getEndDate() == null) {
                return Result.error(400, "周期A日期参数不完整");
            }
            if (request.getPeriodB() == null || request.getPeriodB().getStartDate() == null || request.getPeriodB().getEndDate() == null) {
                return Result.error(400, "周期B日期参数不完整");
            }

            PeriodComparisonResponse response = productSalesService.getPeriodComparison(
                    request.getAsins(),
                    request.getPeriodA(),
                    request.getPeriodB(),
                    request.getShops()
            );
            return Result.success(response);
        } catch (IllegalArgumentException e) {
            return Result.error(400, e.getMessage());
        } catch (Exception e) {
            log.error("双周期对比查询失败", e);
            return Result.error(500, "双周期对比查询失败: " + e.getMessage());
        }
    }

    @PostMapping("/period-trend")
    @Operation(summary = "获取双周期每日趋势", description = "获取双周期的每日销量趋势数据（用于折线图）")
    public Result<PeriodTrendComparisonResponse> getPeriodTrend(
            @RequestBody PeriodComparisonRequest request
    ) {
        try {
            if (request.getAsins() == null || request.getAsins().isEmpty()) {
                return Result.error(400, "ASIN列表不能为空");
            }
            if (request.getAsins().size() > 100) {
                return Result.error(400, "最多同时查询100个ASIN");
            }
            if (request.getPeriodA() == null || request.getPeriodA().getStartDate() == null || request.getPeriodA().getEndDate() == null) {
                return Result.error(400, "周期A日期参数不完整");
            }
            if (request.getPeriodB() == null || request.getPeriodB().getStartDate() == null || request.getPeriodB().getEndDate() == null) {
                return Result.error(400, "周期B日期参数不完整");
            }

            PeriodTrendComparisonResponse response = productSalesService.getPeriodTrend(
                    request.getAsins(),
                    request.getPeriodA(),
                    request.getPeriodB(),
                    request.getShops()
            );
            return Result.success(response);
        } catch (IllegalArgumentException e) {
            return Result.error(400, e.getMessage());
        } catch (Exception e) {
            log.error("获取趋势数据失败", e);
            return Result.error(500, "获取趋势数据失败: " + e.getMessage());
        }
    }

    @GetMapping("/health")
    @Operation(summary = "健康检查", description = "检查产品销量数据服务状态")
    public Result<Map<String, Object>> healthCheck() {
        try {
            Map<String, Object> health = productSalesService.healthCheck();
            return Result.success(health);
        } catch (Exception e) {
            log.error("健康检查失败", e);
            return Result.error(500, "健康检查失败: " + e.getMessage());
        }
    }

    private List<String> parseAsinList(String asins) {
        if (asins == null || asins.isBlank()) {
            return List.of();
        }
        return java.util.Arrays.stream(asins.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(java.util.stream.Collectors.toList());
    }

    private List<String> parseShopList(String shops) {
        if (shops == null || shops.isBlank()) {
            return null;
        }
        return java.util.Arrays.stream(shops.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(java.util.stream.Collectors.toList());
    }

    private static class FileNotFoundError extends RuntimeException {
        public FileNotFoundError(String message) {
            super(message);
        }
    }
}
