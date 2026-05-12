package com.sjzm.controller;

import com.sjzm.common.BusinessException;
import com.sjzm.common.PageResult;
import com.sjzm.common.Result;
import com.sjzm.service.DownloadTaskService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

import java.io.File;
import java.util.List;
import java.util.Map;

/**
 * 下载任务控制器（对齐 Python 的 /download-tasks）
 */
@Slf4j
@Tag(name = "下载任务", description = "下载任务管理、查询、下载、重试")
@RestController
@RequestMapping("/api/v1/download-tasks")
@RequiredArgsConstructor
public class DownloadTaskController {

    private final DownloadTaskService downloadTaskService;

    @Operation(summary = "创建定稿下载任务", description = "创建定稿批量下载任务")
    @PostMapping("/final-draft")
    public Result<Map<String, Object>> createFinalDraftDownloadTask(@RequestBody Map<String, Object> request) {
        try {
            @SuppressWarnings("unchecked")
            List<String> skus = (List<String>) request.get("skus");
            if (skus == null || skus.isEmpty()) {
                return Result.error("SKU列表不能为空");
            }

            String name = "定稿批量下载-" + java.time.LocalDateTime.now().format(
                    java.time.format.DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss"));

            Map<String, Object> result = downloadTaskService.createTask(
                    name, "final_draft", skus, 1L, "system");
            return Result.success(result);
        } catch (Exception e) {
            throw new BusinessException("创建下载任务失败: " + e.getMessage());
        }
    }

    @Operation(summary = "获取任务列表", description = "分页获取下载任务列表")
    @GetMapping
    public Result<PageResult<Map<String, Object>>> getTasks(
            @Parameter(description = "页码") @RequestParam(defaultValue = "1") int page,
            @Parameter(description = "每页数量") @RequestParam(defaultValue = "20") int size,
            @Parameter(description = "状态筛选") @RequestParam(required = false) String status,
            @Parameter(description = "来源筛选") @RequestParam(required = false) String source,
            @Parameter(description = "关键词搜索") @RequestParam(required = false) String keyword) {
        try {
            PageResult<Map<String, Object>> result = downloadTaskService.getTasks(
                    null, status, source, keyword, page, size);
            return Result.success(result);
        } catch (Exception e) {
            throw new BusinessException("获取任务列表失败: " + e.getMessage());
        }
    }

    @Operation(summary = "获取任务详情", description = "根据ID获取任务详情")
    @GetMapping("/{id}")
    public Result<Map<String, Object>> getTask(@PathVariable Long id) {
        try {
            Map<String, Object> result = downloadTaskService.getTask(id);
            return Result.success(result);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            throw new BusinessException("获取任务详情失败: " + e.getMessage());
        }
    }

    @Operation(summary = "更新任务状态", description = "更新下载任务状态")
    @PutMapping("/{id}/status")
    public Result<Map<String, Object>> updateTaskStatus(
            @PathVariable Long id,
            @RequestBody Map<String, Object> data) {
        try {
            String status = (String) data.get("status");
            String filePath = (String) data.get("file_path");
            String filename = (String) data.get("filename");
            Long fileSize = data.get("file_size") != null ?
                    ((Number) data.get("file_size")).longValue() : null;

            Map<String, Object> result = downloadTaskService.updateTaskStatus(
                    id, status, filePath, filename, fileSize);
            return Result.success(result);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            throw new BusinessException("更新任务状态失败: " + e.getMessage());
        }
    }

    @Operation(summary = "删除任务", description = "删除指定的下载任务")
    @DeleteMapping("/{id}")
    public Result<Void> deleteTask(@PathVariable Long id) {
        try {
            downloadTaskService.deleteTask(id);
            return Result.success();
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            throw new BusinessException("删除任务失败: " + e.getMessage());
        }
    }

    @Operation(summary = "批量删除任务", description = "批量删除下载任务")
    @PostMapping("/batch-delete")
    public Result<Map<String, Object>> batchDeleteTasks(@RequestBody List<Long> ids) {
        try {
            if (ids == null || ids.isEmpty()) {
                return Result.error("任务ID列表不能为空");
            }
            Map<String, Object> result = downloadTaskService.batchDeleteTasks(ids);
            return Result.success(result);
        } catch (Exception e) {
            throw new BusinessException("批量删除任务失败: " + e.getMessage());
        }
    }

    @Operation(summary = "重试失败任务", description = "重试失败的任务")
    @PostMapping("/{id}/retry")
    public Result<Map<String, Object>> retryTask(@PathVariable Long id) {
        try {
            Map<String, Object> result = downloadTaskService.retryTask(id);
            return Result.success(result);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            throw new BusinessException("重试任务失败: " + e.getMessage());
        }
    }

    @Operation(summary = "下载任务文件", description = "下载已完成任务的文件")
    @GetMapping("/{id}/download")
    public ResponseEntity<Resource> downloadFile(@PathVariable Long id) {
        try {
            Map<String, Object> task = downloadTaskService.getTask(id);

            if (!"completed".equals(task.get("status"))) {
                throw new BusinessException(400, "任务尚未完成");
            }

            String filePath = (String) task.get("file_path");
            if (filePath == null || filePath.isEmpty()) {
                throw new BusinessException(404, "文件不存在");
            }

            File file = new File(filePath);
            if (!file.exists()) {
                throw new BusinessException(404, "文件不存在");
            }

            Resource resource = new FileSystemResource(file);
            String filename = (String) task.get("filename");
            if (filename == null) {
                filename = file.getName();
            }

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
            headers.setContentDisposition(ContentDisposition.builder("attachment")
                    .filename(filename)
                    .build());

            return ResponseEntity.ok().headers(headers).body(resource);

        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("下载文件失败: " + e.getMessage());
        }
    }

    @Operation(summary = "清理过期任务", description = "清理过期的下载任务")
    @DeleteMapping("/cleanup")
    public Result<Map<String, Object>> cleanupOldTasks(
            @Parameter(description = "清理多少天前的任务") @RequestParam(defaultValue = "7") int days) {
        try {
            Map<String, Object> result = downloadTaskService.cleanupOldTasks(days);
            return Result.success(result);
        } catch (Exception e) {
            throw new BusinessException("清理过期任务失败: " + e.getMessage());
        }
    }
}
