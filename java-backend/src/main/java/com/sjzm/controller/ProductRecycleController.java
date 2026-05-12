package com.sjzm.controller;

import com.sjzm.common.BusinessException;
import com.sjzm.common.PageResult;
import com.sjzm.common.Result;
import com.sjzm.service.ProductRecycleService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 产品回收站控制器
 */
@Tag(name = "产品回收站", description = "产品回收站管理、恢复、永久删除")
@RestController
@RequestMapping("/api/v1/product-recycle")
@RequiredArgsConstructor
public class ProductRecycleController {

    private final ProductRecycleService productRecycleService;

    @Operation(summary = "获取回收站产品列表", description = "分页查询回收站中的产品")
    @GetMapping("/products")
    public Result<PageResult<Map<String, Object>>> listRecycleProducts(
            @Parameter(description = "页码") @RequestParam(defaultValue = "1") int page,
            @Parameter(description = "每页数量") @RequestParam(defaultValue = "20") int size,
            @Parameter(description = "搜索关键词") @RequestParam(required = false) String keyword) {
        try {
            PageResult<Map<String, Object>> result = productRecycleService.listRecycleProducts(page, size, keyword);
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("获取回收站产品列表失败: " + e.getMessage());
        }
    }

    @Operation(summary = "获取回收站统计", description = "获取回收站产品统计数据")
    @GetMapping("/stats")
    public Result<Map<String, Object>> getRecycleStats() {
        try {
            Map<String, Object> stats = productRecycleService.getRecycleStats();
            return Result.success(stats);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("获取回收站统计失败: " + e.getMessage());
        }
    }

    @Operation(summary = "恢复产品", description = "从回收站恢复单个产品")
    @PostMapping("/products/{sku}/restore")
    public Result<Void> restoreProduct(@PathVariable String sku) {
        try {
            productRecycleService.restoreProduct(sku);
            return Result.success();
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("恢复产品失败: " + e.getMessage());
        }
    }

    @Operation(summary = "批量恢复产品", description = "批量从回收站恢复产品")
    @PostMapping("/products/batch-restore")
    public Result<Map<String, Object>> batchRestoreProducts(@RequestBody List<String> skus) {
        try {
            Map<String, Object> result = productRecycleService.batchRestoreProducts(skus);
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("批量恢复产品失败: " + e.getMessage());
        }
    }

    @Operation(summary = "永久删除产品", description = "从回收站永久删除单个产品")
    @DeleteMapping("/products/{sku}")
    public Result<Void> permanentlyDeleteProduct(@PathVariable String sku) {
        try {
            productRecycleService.permanentlyDeleteProduct(sku);
            return Result.success();
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("永久删除产品失败: " + e.getMessage());
        }
    }

    @Operation(summary = "批量永久删除产品", description = "批量永久删除回收站中的产品")
    @DeleteMapping("/products/batch")
    public Result<Map<String, Object>> batchPermanentlyDeleteProducts(@RequestBody List<String> skus) {
        try {
            Map<String, Object> result = productRecycleService.batchPermanentlyDeleteProducts(skus);
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("批量永久删除产品失败: " + e.getMessage());
        }
    }

    @Operation(summary = "清理过期产品", description = "清理回收站中已过期的产品")
    @DeleteMapping("/products/clear-expired")
    public Result<Map<String, Object>> clearExpiredProducts() {
        try {
            Map<String, Object> result = productRecycleService.clearExpiredProducts();
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("清理过期产品失败: " + e.getMessage());
        }
    }
}
