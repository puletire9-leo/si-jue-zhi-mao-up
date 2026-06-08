package com.sjzm.product.controller;

import com.sjzm.common.Result;
import com.sjzm.product.service.AsinImportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/asin-import")
@RequiredArgsConstructor
@Tag(name = "ASIN导入", description = "上传文件 → 筛选预览 → 分块调用API")
public class AsinImportController {

    private final AsinImportService asinImportService;

    @PostMapping("/upload")
    @Operation(summary = "上传文件并筛选预览（支持多文件）")
    public Result<Map<String, Object>> upload(
            @RequestParam("files") List<MultipartFile> files,
            @RequestParam(defaultValue = "UK") String marketplace) {
        Map<String, Object> preview = asinImportService.uploadAndFilter(files, marketplace);
        return Result.success(preview);
    }

    @PostMapping("/execute")
    @Operation(summary = "开始逐批调用卖家精灵API（异步执行）")
    public Result<Map<String, Object>> execute(
            @RequestParam Long taskId,
            @RequestParam(defaultValue = "") String month,
            @RequestParam(required = false) String marketplace) {
        if (marketplace != null && !marketplace.isBlank()) {
            asinImportService.updateTaskMarketplace(taskId, marketplace);
        }
        asinImportService.executeApiCalls(taskId, month);
        return Result.success(Map.of("taskId", taskId, "status", "RUNNING"));
    }

    @GetMapping("/progress/{taskId}")
    @Operation(summary = "查询任务进度")
    public Result<Map<String, Object>> progress(@PathVariable Long taskId) {
        return Result.success(asinImportService.getProgress(taskId));
    }

    @PostMapping("/cancel/{taskId}")
    @Operation(summary = "暂停或停止任务")
    public Result<Void> cancel(
            @PathVariable Long taskId,
            @RequestParam(defaultValue = "stop") String action) {
        asinImportService.cancelTask(taskId, action);
        return Result.success();
    }

    @GetMapping("/history")
    @Operation(summary = "获取导入历史记录")
    public Result<List<Map<String, Object>>> history() {
        return Result.success(asinImportService.getHistory());
    }

    @GetMapping("/results/{taskId}")
    @Operation(summary = "查看导入任务的 ASIN 明细")
    public Result<Map<String, Object>> results(@PathVariable Long taskId) {
        return Result.success(asinImportService.getResults(taskId));
    }

    @PostMapping("/retry/{taskId}")
    @Operation(summary = "从失败 ASIN 创建新的导入任务（无重复）")
    public Result<Map<String, Object>> retry(@PathVariable Long taskId) {
        Map<String, Object> newTask = asinImportService.retryFailedAsins(taskId);
        return Result.success(newTask);
    }

    @PostMapping("/seller/preview")
    @Operation(summary = "卖家名批量导入 - 预览")
    public Result<Map<String, Object>> sellerPreview(@RequestBody Map<String, Object> body) {
        @SuppressWarnings("unchecked")
        List<String> sellerNames = (List<String>) body.get("sellerNames");
        String marketplace = (String) body.getOrDefault("marketplace", "UK");
        if (sellerNames == null || sellerNames.isEmpty()) {
            throw new RuntimeException("sellerNames 不能为空");
        }
        return Result.success(asinImportService.sellerPreview(sellerNames, marketplace));
    }

    @PostMapping("/seller/execute")
    @Operation(summary = "卖家名批量导入 - 执行（异步）")
    public Result<Map<String, Object>> sellerExecute(
            @RequestParam Long taskId,
            @RequestParam(defaultValue = "") String month) {
        asinImportService.sellerExecute(taskId, month);
        return Result.success(Map.of("taskId", taskId, "status", "RUNNING"));
    }
}
