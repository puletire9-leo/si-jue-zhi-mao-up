package com.sjzm.controller;

import com.sjzm.common.BusinessException;
import com.sjzm.common.PageResult;
import com.sjzm.common.Result;
import com.sjzm.service.SelectionRecycleService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 选品回收站控制器
 */
@Tag(name = "选品回收站", description = "选品回收站管理、恢复、永久删除")
@RestController
@RequestMapping("/api/v1/selection/recycle")
@RequiredArgsConstructor
public class SelectionRecycleController {

    private final SelectionRecycleService selectionRecycleService;

    @Operation(summary = "获取回收站选品列表", description = "分页查询回收站中的选品")
    @GetMapping("/products")
    public Result<PageResult<Map<String, Object>>> listRecycleProducts(
            @Parameter(description = "页码") @RequestParam(defaultValue = "1") int page,
            @Parameter(description = "每页数量") @RequestParam(defaultValue = "20") int size,
            @Parameter(description = "搜索关键词") @RequestParam(required = false) String keyword) {
        try {
            PageResult<Map<String, Object>> result = selectionRecycleService.listRecycleProducts(page, size, keyword);
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("获取回收站选品列表失败: " + e.getMessage());
        }
    }

    @Operation(summary = "获取回收站统计", description = "获取回收站选品统计数据")
    @GetMapping("/stats")
    public Result<Map<String, Object>> getRecycleStats() {
        try {
            Map<String, Object> stats = selectionRecycleService.getRecycleStats();
            return Result.success(stats);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("获取回收站统计失败: " + e.getMessage());
        }
    }

    @Operation(summary = "恢复选品", description = "从回收站恢复单个选品")
    @PostMapping("/products/{id}/restore")
    public Result<Void> restoreSelection(@PathVariable Long id) {
        try {
            selectionRecycleService.restoreSelection(id);
            return Result.success();
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("恢复选品失败: " + e.getMessage());
        }
    }

    @Operation(summary = "批量恢复选品", description = "批量从回收站恢复选品")
    @PostMapping("/products/batch-restore")
    public Result<Map<String, Object>> batchRestoreSelections(@RequestBody Map<String, Object> request) {
        try {
            @SuppressWarnings("unchecked")
            List<Long> ids = request.containsKey("recycle_ids")
                    ? (List<Long>) request.get("recycle_ids")
                    : (List<Long>) request.get("ids");
            if (ids == null || ids.isEmpty()) {
                throw new BusinessException("请选择要恢复的选品");
            }
            Map<String, Object> result = selectionRecycleService.batchRestoreSelections(ids);
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("批量恢复选品失败: " + e.getMessage());
        }
    }

    @Operation(summary = "从回收站永久删除选品", description = "根据ASIN永久删除回收站中的选品")
    @PostMapping("/delete")
    public Result<Map<String, Object>> permanentlyDeleteByAsins(@RequestBody Map<String, Object> request) {
        try {
            @SuppressWarnings("unchecked")
            List<String> asins = (List<String>) request.get("asins");
            if (asins == null || asins.isEmpty()) {
                throw new BusinessException("请选择要删除的选品");
            }
            Map<String, Object> result = selectionRecycleService.permanentlyDeleteByAsins(asins);
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("永久删除选品失败: " + e.getMessage());
        }
    }

    @Operation(summary = "永久删除选品", description = "从回收站永久删除单个选品")
    @DeleteMapping("/products/{id}")
    public Result<Void> permanentlyDeleteSelection(@PathVariable Long id) {
        try {
            selectionRecycleService.permanentlyDeleteSelection(id);
            return Result.success();
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("永久删除选品失败: " + e.getMessage());
        }
    }

    @Operation(summary = "批量永久删除选品", description = "批量永久删除回收站中的选品")
    @DeleteMapping("/products/batch")
    public Result<Map<String, Object>> batchPermanentlyDeleteSelections(@RequestBody List<Long> ids) {
        try {
            Map<String, Object> result = selectionRecycleService.batchPermanentlyDeleteSelections(ids);
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("批量永久删除选品失败: " + e.getMessage());
        }
    }

    @Operation(summary = "清空回收站", description = "清空选品回收站中的所有数据")
    @DeleteMapping("/clear")
    public Result<Map<String, Object>> clearRecycleBin() {
        try {
            Map<String, Object> result = selectionRecycleService.clearRecycleBin();
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("清空回收站失败: " + e.getMessage());
        }
    }

    @Operation(summary = "清理过期选品", description = "清理回收站中超过指定天数的过期选品")
    @DeleteMapping("/clear-expired")
    public Result<Map<String, Object>> clearExpiredProducts(
            @Parameter(description = "过期天数（默认30天）") @RequestParam(defaultValue = "30") int days) {
        try {
            if (days < 1 || days > 365) {
                throw new BusinessException("过期天数必须在1-365之间");
            }
            Map<String, Object> result = selectionRecycleService.clearExpiredProducts(days);
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("清理过期选品失败: " + e.getMessage());
        }
    }
}
