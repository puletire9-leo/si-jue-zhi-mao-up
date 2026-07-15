package com.sjzm.product.modules.developerselection.controller;

import com.sjzm.common.Result;
import com.sjzm.product.modules.developerselection.dto.DeveloperSelectionBatchActionRequest;
import com.sjzm.product.modules.developerselection.dto.DeveloperSelectionBatchAddRequest;
import com.sjzm.product.modules.developerselection.dto.DeveloperSelectionBatchAssignRequest;
import com.sjzm.product.modules.developerselection.dto.DeveloperSelectionBatchCreateRequest;
import com.sjzm.product.modules.developerselection.dto.DeveloperSelectionLibraryQuery;
import com.sjzm.product.modules.developerselection.service.DeveloperSelectionLibraryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/modules/developer-selection-library")
@RequiredArgsConstructor
@Tag(name = "开发人工选品库", description = "每个开发独立的好品/差品人工选品库")
public class DeveloperSelectionLibraryController {

    private final DeveloperSelectionLibraryService service;

    @PostMapping("/items")
    @Operation(summary = "批量加入好品库或差品库")
    public Result<Map<String, Object>> addItems(
            @RequestHeader("X-User-Id") Long userId,
            @RequestHeader(value = "X-Username", required = false) String username,
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @Valid @RequestBody DeveloperSelectionBatchAddRequest request) {
        return Result.success(service.addItems(userId, username, role, request));
    }

    @GetMapping("/items")
    @Operation(summary = "分页查询人工选品库")
    public Result<Map<String, Object>> list(
            @RequestHeader("X-User-Id") Long userId,
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @ModelAttribute DeveloperSelectionLibraryQuery query) {
        return Result.success(service.list(userId, role, query));
    }

    @GetMapping("/weeks")
    @Operation(summary = "获取人工选品库可选周周期")
    public Result<List<Map<String, Object>>> weeks(
            @RequestHeader("X-User-Id") Long userId,
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @ModelAttribute DeveloperSelectionLibraryQuery query) {
        return Result.success(service.weekOptions(userId, role, query));
    }

    @GetMapping("/developers")
    @Operation(summary = "获取开发人员筛选项")
    public Result<List<Map<String, Object>>> developers(
            @RequestHeader("X-User-Id") Long userId,
            @RequestHeader(value = "X-Username", required = false) String username,
            @RequestHeader(value = "X-User-Role", required = false) String role) {
        return Result.success(service.developerOptions(userId, username, role));
    }

    @GetMapping("/batches")
    @Operation(summary = "获取当前好品/差品库的人工批次")
    public Result<List<Map<String, Object>>> batches(
            @RequestHeader("X-User-Id") Long userId,
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestParam(required = false) String bucket,
            @RequestParam(required = false) Long developerId) {
        return Result.success(service.listBatches(userId, role, bucket, developerId));
    }

    @PostMapping("/batches")
    @Operation(summary = "新建人工选品批次")
    public Result<Map<String, Object>> createBatch(
            @RequestHeader("X-User-Id") Long userId,
            @RequestHeader(value = "X-Username", required = false) String username,
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @Valid @RequestBody DeveloperSelectionBatchCreateRequest request) {
        return Result.success(service.createBatch(userId, username, role, request));
    }

    @PostMapping("/batches/assign")
    @Operation(summary = "将人工选品批量加入批次")
    public Result<Map<String, Integer>> assignBatch(
            @RequestHeader("X-User-Id") Long userId,
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @Valid @RequestBody DeveloperSelectionBatchAssignRequest request) {
        return Result.success(Map.of("assigned",
                service.assignBatch(userId, role, request.getIds(), request.getBatchId())));
    }

    @PostMapping("/batches/unassign")
    @Operation(summary = "将人工选品批量移出分类")
    public Result<Map<String, Integer>> unassignBatch(
            @RequestHeader("X-User-Id") Long userId,
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @Valid @RequestBody DeveloperSelectionBatchActionRequest request) {
        return Result.success(Map.of("unassigned", service.unassignBatch(userId, role, request.getIds())));
    }

    @PostMapping("/convert")
    @Operation(summary = "好品库与差品库批量转换")
    public Result<Map<String, Integer>> convert(
            @RequestHeader("X-User-Id") Long userId,
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @Valid @RequestBody DeveloperSelectionBatchActionRequest request) {
        return Result.success(Map.of("converted", service.convert(userId, role, request.getIds(), request.getTargetBucket())));
    }

    @DeleteMapping("/items")
    @Operation(summary = "批量移出人工选品库")
    public Result<Map<String, Integer>> delete(
            @RequestHeader("X-User-Id") Long userId,
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @Valid @RequestBody DeveloperSelectionBatchActionRequest request) {
        return Result.success(Map.of("deleted", service.delete(userId, role, request.getIds())));
    }
}
