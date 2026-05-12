package com.sjzm.controller;

import com.sjzm.common.BusinessException;
import com.sjzm.common.Result;
import com.sjzm.service.BackupService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 备份控制器
 */
@Slf4j
@Tag(name = "备份管理", description = "数据库备份CRUD")
@RestController
@RequestMapping("/api/v1/system-config")
@RequiredArgsConstructor
public class BackupController {

    private final BackupService backupService;

    @Operation(summary = "开始备份", description = "创建数据库备份")
    @PostMapping("/backup/start")
    public Result<Map<String, Object>> startBackup(
            @Parameter(description = "备份类型: local(本地) 或 cos(腾讯云)") @RequestParam(defaultValue = "local") String backupType) {
        try {
            Map<String, Object> result = backupService.createBackup(backupType);
            if ((Boolean) result.get("success")) {
                return Result.success(result);
            } else {
                return Result.error((String) result.get("message"));
            }
        } catch (Exception e) {
            throw new BusinessException("开始备份失败: " + e.getMessage());
        }
    }

    @Operation(summary = "获取备份记录", description = "分页获取备份记录列表")
    @GetMapping("/backup/records")
    public Result<Map<String, Object>> getBackupRecords(
            @Parameter(description = "页码") @RequestParam(defaultValue = "1") int page,
            @Parameter(description = "每页数量") @RequestParam(defaultValue = "10") int limit,
            @Parameter(description = "存储位置过滤: local 或 cos") @RequestParam(required = false) String storageLocation) {
        try {
            Map<String, Object> result = backupService.getBackupRecords(page, limit, storageLocation);
            if ((Boolean) result.get("success")) {
                return Result.success(result);
            } else {
                return Result.error((String) result.get("message"));
            }
        } catch (Exception e) {
            throw new BusinessException("获取备份记录失败: " + e.getMessage());
        }
    }

    @Operation(summary = "获取备份下载URL", description = "获取备份文件的下载URL")
    @GetMapping("/backup/download/{backupId}")
    @SuppressWarnings({"unchecked", "rawtypes"})
    public Result<Map<String, Object>> getBackupDownloadUrl(
            @Parameter(description = "备份记录ID") @PathVariable Long backupId) {
        try {
            Map<String, Object> result = backupService.getBackupUrl(backupId);
            if (Boolean.TRUE.equals(result.get("success"))) {
                Object data = result.get("data");
                return Result.success((Map<String, Object>) data);
            } else {
                return Result.error((String) result.get("message"));
            }
        } catch (Exception e) {
            throw new BusinessException("获取备份下载URL失败: " + e.getMessage());
        }
    }

    @Operation(summary = "删除备份", description = "删除指定的备份记录")
    @DeleteMapping("/backup/{backupId}")
    public Result<Map<String, Object>> deleteBackup(
            @Parameter(description = "备份记录ID") @PathVariable Long backupId) {
        try {
            Map<String, Object> result = backupService.deleteBackup(backupId);
            if ((Boolean) result.get("success")) {
                return Result.success(result);
            } else {
                return Result.error((String) result.get("message"));
            }
        } catch (Exception e) {
            throw new BusinessException("删除备份失败: " + e.getMessage());
        }
    }

    @Operation(summary = "获取过期备份", description = "获取超过3天的备份记录")
    @GetMapping("/backup/expired")
    public Result<Map<String, Object>> getExpiredBackups() {
        try {
            Map<String, Object> result = backupService.getExpiredBackups();
            if ((Boolean) result.get("success")) {
                return Result.success(result);
            } else {
                return Result.error((String) result.get("message"));
            }
        } catch (Exception e) {
            throw new BusinessException("获取过期备份失败: " + e.getMessage());
        }
    }

    @Operation(summary = "删除过期备份", description = "删除超过3天的备份记录")
    @DeleteMapping("/backup/expired")
    public Result<Map<String, Object>> deleteExpiredBackups() {
        try {
            Map<String, Object> result = backupService.deleteExpiredBackups();
            if ((Boolean) result.get("success")) {
                return Result.success(result);
            } else {
                return Result.error((String) result.get("message"));
            }
        } catch (Exception e) {
            throw new BusinessException("删除过期备份失败: " + e.getMessage());
        }
    }
}
