package com.sjzm.controller;

import com.sjzm.common.BusinessException;
import com.sjzm.common.Result;
import com.sjzm.service.SystemLogService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 系统日志控制器
 */
@Slf4j
@Tag(name = "系统日志", description = "系统文档、更新记录、需求清单CRUD")
@RestController
@RequestMapping("/api/v1/system-docs")
@RequiredArgsConstructor
public class SystemLogController {

    private final SystemLogService systemLogService;

    // ==================== 系统文档 ====================

    @Operation(summary = "创建系统文档", description = "创建新的系统文档")
    @PostMapping
    public Result<Map<String, Object>> createSystemDoc(@RequestBody Map<String, Object> docData) {
        try {
            Map<String, Object> result = systemLogService.createSystemDoc(docData);
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("创建系统文档失败: " + e.getMessage());
        }
    }

    @Operation(summary = "获取系统文档列表", description = "分页获取系统文档列表")
    @GetMapping
    public Result<Map<String, Object>> getSystemDocs(
            @Parameter(description = "页码") @RequestParam(defaultValue = "1") int page,
            @Parameter(description = "每页数量") @RequestParam(defaultValue = "10") int limit,
            @Parameter(description = "文档类型") @RequestParam(required = false) String docType,
            @Parameter(description = "搜索关键词") @RequestParam(required = false) String keyword) {
        try {
            Map<String, Object> result = systemLogService.getSystemDocs(page, limit, docType, keyword);
            return Result.success(result);
        } catch (Exception e) {
            throw new BusinessException("获取系统文档列表失败: " + e.getMessage());
        }
    }

    @Operation(summary = "获取系统文档详情", description = "根据ID获取系统文档详情")
    @GetMapping("/{docId}")
    public Result<Map<String, Object>> getSystemDoc(
            @Parameter(description = "文档ID") @PathVariable Long docId) {
        try {
            Map<String, Object> result = systemLogService.getSystemDoc(docId);
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("获取系统文档详情失败: " + e.getMessage());
        }
    }

    @Operation(summary = "更新系统文档", description = "更新系统文档内容")
    @PutMapping("/{docId}")
    public Result<Map<String, Object>> updateSystemDoc(
            @Parameter(description = "文档ID") @PathVariable Long docId,
            @RequestBody Map<String, Object> updateData) {
        try {
            Map<String, Object> result = systemLogService.updateSystemDoc(docId, updateData);
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("更新系统文档失败: " + e.getMessage());
        }
    }

    @Operation(summary = "删除系统文档", description = "删除指定的系统文档")
    @DeleteMapping("/{docId}")
    public Result<Void> deleteSystemDoc(
            @Parameter(description = "文档ID") @PathVariable Long docId) {
        try {
            boolean success = systemLogService.deleteSystemDoc(docId);
            if (success) {
                return Result.success(null);
            } else {
                return Result.error("删除失败");
            }
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("删除系统文档失败: " + e.getMessage());
        }
    }

    // ==================== 更新记录 ====================

    @Operation(summary = "创建更新记录", description = "创建新的更新记录")
    @PostMapping("/updates")
    public Result<Map<String, Object>> createUpdateRecord(@RequestBody Map<String, Object> recordData) {
        try {
            Map<String, Object> result = systemLogService.createUpdateRecord(recordData);
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("创建更新记录失败: " + e.getMessage());
        }
    }

    @Operation(summary = "获取更新记录列表", description = "分页获取更新记录列表")
    @GetMapping("/updates")
    public Result<Map<String, Object>> getUpdateRecords(
            @Parameter(description = "页码") @RequestParam(defaultValue = "1") int page,
            @Parameter(description = "每页数量") @RequestParam(defaultValue = "10") int limit) {
        try {
            Map<String, Object> result = systemLogService.getUpdateRecords(page, limit);
            return Result.success(result);
        } catch (Exception e) {
            throw new BusinessException("获取更新记录列表失败: " + e.getMessage());
        }
    }

    // ==================== 需求清单 ====================

    @Operation(summary = "创建需求", description = "创建新的需求")
    @PostMapping("/requirements")
    public Result<Map<String, Object>> createRequirement(@RequestBody Map<String, Object> reqData) {
        try {
            Map<String, Object> result = systemLogService.createRequirement(reqData);
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("创建需求失败: " + e.getMessage());
        }
    }

    @Operation(summary = "获取需求列表", description = "分页获取需求列表")
    @GetMapping("/requirements")
    public Result<Map<String, Object>> getRequirements(
            @Parameter(description = "页码") @RequestParam(defaultValue = "1") int page,
            @Parameter(description = "每页数量") @RequestParam(defaultValue = "10") int limit,
            @Parameter(description = "状态") @RequestParam(required = false) String status,
            @Parameter(description = "优先级") @RequestParam(required = false) String priority) {
        try {
            Map<String, Object> result = systemLogService.getRequirements(page, limit, status, priority);
            return Result.success(result);
        } catch (Exception e) {
            throw new BusinessException("获取需求列表失败: " + e.getMessage());
        }
    }

    @Operation(summary = "更新需求状态", description = "更新需求的处理状态")
    @PutMapping("/requirements/{reqId}/status")
    public Result<Map<String, Object>> updateRequirementStatus(
            @Parameter(description = "需求ID") @PathVariable Long reqId,
            @RequestBody Map<String, Object> data) {
        try {
            String status = (String) data.get("status");
            Map<String, Object> result = systemLogService.updateRequirementStatus(reqId, status);
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("更新需求状态失败: " + e.getMessage());
        }
    }
}
