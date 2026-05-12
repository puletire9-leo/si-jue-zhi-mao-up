package com.sjzm.controller;

import com.sjzm.common.PageResult;
import com.sjzm.common.Result;
import com.sjzm.entity.RecycleBin;
import com.sjzm.service.RecycleBinService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 产品回收站管理
 * 
 * 参考：backend/app/api/v1/recycle_bin.py
 */
@Tag(name = "回收站管理")
@Slf4j
@RestController
@RequestMapping("/api/v1/recycle-bin")
public class RecycleBinController {

    @Autowired
    private RecycleBinService recycleBinService;

    @GetMapping("/stats")
    @Operation(summary = "获取回收站统计")
    public Result<Map<String, Object>> getStats() {
        Map<String, Object> stats = recycleBinService.getStats();
        return Result.success(stats);
    }

    @GetMapping("/products")
    @Operation(summary = "获取回收站产品列表")
    public Result<PageResult<RecycleBin>> listProducts(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {

        var pageResult = recycleBinService.listRecycleBinItems(page, size, q, startDate, endDate);
        PageResult<RecycleBin> result = new PageResult<>(
                pageResult.getRecords(),
                pageResult.getTotal(),
                pageResult.getCurrent(),
                pageResult.getSize()
        );
        return Result.success(result);
    }

    @PostMapping("/restore/{sku}")
    @Operation(summary = "恢复产品")
    public Result<Map<String, Object>> restoreProduct(@PathVariable String sku) {
        Map<String, Object> result = recycleBinService.restoreProduct(sku);
        return Result.success(result);
    }

    @PostMapping("/batch-restore")
    @Operation(summary = "批量恢复产品")
    public Result<Map<String, Object>> batchRestoreProducts(@RequestBody String[] skus) {
        Map<String, Object> result = recycleBinService.batchRestoreProducts(skus);
        return Result.success(result);
    }

    @DeleteMapping("/{sku}")
    @Operation(summary = "永久删除产品")
    public Result<Map<String, Object>> deletePermanently(@PathVariable String sku) {
        Map<String, Object> result = recycleBinService.deletePermanently(sku);
        return Result.success(result);
    }

    @DeleteMapping("/batch")
    @Operation(summary = "批量永久删除产品")
    public Result<Map<String, Object>> batchDeletePermanently(@RequestBody String[] skus) {
        Map<String, Object> result = recycleBinService.batchDeletePermanently(skus);
        return Result.success(result);
    }

    @DeleteMapping("/expired")
    @Operation(summary = "清理过期产品")
    public Result<Map<String, Object>> cleanExpiredProducts() {
        Map<String, Object> result = recycleBinService.cleanExpiredProducts();
        return Result.success(result);
    }
}
