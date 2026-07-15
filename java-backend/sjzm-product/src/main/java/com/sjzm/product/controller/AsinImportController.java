package com.sjzm.product.controller;

import com.sjzm.common.Result;
import com.sjzm.product.entity.AsinImportTask;
import com.sjzm.product.service.AsinImportService;
import com.sjzm.product.modules.requestcenter.entity.SellerspriteRequestRun;
import com.sjzm.product.modules.requestcenter.service.SellerspriteRequestCenterService;
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
    private final SellerspriteRequestCenterService requestCenterService;

    @PostMapping("/upload")
    @Operation(summary = "上传文件并筛选预览（支持多文件）")
    public Result<Map<String, Object>> upload(
            @RequestParam("files") List<MultipartFile> files,
            @RequestParam(defaultValue = "UK") String marketplace) {
        Map<String, Object> preview = asinImportService.uploadAndFilter(files, marketplace);
        return Result.success(preview);
    }

    @PostMapping("/execute")
    @Operation(summary = "创建 ASIN 请求中心任务", description = "兼容旧入口：返回 runId，不直接调用卖家精灵")
    public Result<Map<String, Object>> execute(
            @RequestParam Long taskId,
            @RequestParam(defaultValue = "") String month,
            @RequestParam(required = false) String marketplace) {
        if (marketplace != null && !marketplace.isBlank()) {
            asinImportService.updateTaskMarketplace(taskId, marketplace);
        }
        SellerspriteRequestRun run = requestCenterService.createTaskFromStreamingResult(taskId,
                "ASIN_IMPORT_API", "ASIN 导入执行");
        return Result.success(Map.of("taskId", taskId, "runId", run.getRunId(), "status", run.getStatus()));
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
    @Operation(summary = "从失败 ASIN 创建新的请求中心任务（无重复）")
    public Result<Map<String, Object>> retry(@PathVariable Long taskId) {
        Map<String, Object> newTask = asinImportService.retryFailedAsins(taskId);
        Long newTaskId = ((Number) newTask.get("newTaskId")).longValue();
        SellerspriteRequestRun run = requestCenterService.createTaskFromStreamingResult(newTaskId,
                "ASIN_IMPORT_RETRY_API", "ASIN 导入失败重试");
        newTask.put("runId", run.getRunId());
        newTask.put("status", run.getStatus());
        return Result.success(newTask);
    }

    @PostMapping("/seller/preview")
    @Operation(summary = "卖家名批量导入 - 预览")
    public Result<Map<String, Object>> sellerPreview(@RequestBody Map<String, Object> body) {
        @SuppressWarnings("unchecked")
        List<String> sellerNames = (List<String>) body.get("sellerNames");
        String marketplace = (String) body.getOrDefault("marketplace", "UK");
        String target = (String) body.getOrDefault("target", "competitor_products");
        if (sellerNames == null || sellerNames.isEmpty()) {
            throw new RuntimeException("sellerNames 不能为空");
        }
        return Result.success(asinImportService.sellerPreview(sellerNames, marketplace, target));
    }

    @PostMapping("/seller/execute")
    @Operation(summary = "创建卖家名批量请求中心任务", description = "兼容旧入口：返回 runId，不直接调用卖家精灵")
    public Result<Map<String, Object>> sellerExecute(
            @RequestParam Long taskId,
            @RequestParam(defaultValue = "") String month,
            @RequestParam(defaultValue = "competitor_products") String target) {
        SellerspriteRequestRun run = requestCenterService.createSellerBatchTask(taskId, target, month, "SELLER_IMPORT_API");
        return Result.success(Map.of("taskId", taskId, "runId", run.getRunId(), "status", run.getStatus(),
                "batchTotal", run.getTotalCount()));
    }
}
