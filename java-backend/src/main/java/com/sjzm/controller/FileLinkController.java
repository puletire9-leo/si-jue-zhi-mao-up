package com.sjzm.controller;

import com.sjzm.common.BusinessException;
import com.sjzm.common.PageResult;
import com.sjzm.common.Result;
import com.sjzm.service.FileLinkService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

/**
 * 文件链接控制器（对齐 Python 的 /file-links）
 */
@Slf4j
@Tag(name = "文件链接管理", description = "文件链接 CRUD、批量操作、链接状态检查")
@RestController
@RequestMapping("/api/v1/file-links")
@RequiredArgsConstructor
public class FileLinkController {

    private final FileLinkService fileLinkService;

    @Operation(summary = "创建文件链接", description = "创建新的文件链接")
    @PostMapping
    public Result<Map<String, Object>> createFileLink(@RequestBody Map<String, Object> data) {
        try {
            Map<String, Object> result = fileLinkService.createFileLink(data);
            return Result.success(result);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("创建文件链接失败: " + e.getMessage());
        }
    }

    @Operation(summary = "获取文件链接列表", description = "分页获取文件链接列表，支持多条件筛选")
    @GetMapping
    public Result<PageResult<Map<String, Object>>> getFileLinks(
            @Parameter(description = "所属库类型") @RequestParam(required = false) String library_type,
            @Parameter(description = "页码") @RequestParam(defaultValue = "1") int page,
            @Parameter(description = "每页数量") @RequestParam(defaultValue = "12") int size,
            @Parameter(description = "搜索关键词") @RequestParam(required = false) String keyword,
            @Parameter(description = "分类筛选") @RequestParam(required = false) String category,
            @Parameter(description = "链接类型") @RequestParam(required = false) String link_type,
            @Parameter(description = "状态筛选") @RequestParam(required = false) String status) {
        try {
            PageResult<Map<String, Object>> result = fileLinkService.getFileLinks(
                    library_type, page, size, keyword, category, link_type, status);
            return Result.success(result);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("获取文件链接列表失败: " + e.getMessage());
        }
    }

    @Operation(summary = "获取单个文件链接", description = "根据ID获取文件链接详情")
    @GetMapping("/{id}")
    public Result<Map<String, Object>> getFileLink(@PathVariable Long id) {
        try {
            Map<String, Object> result = fileLinkService.getFileLink(id);
            return Result.success(result);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("获取文件链接失败: " + e.getMessage());
        }
    }

    @Operation(summary = "更新文件链接", description = "更新文件链接信息")
    @PutMapping("/{id}")
    public Result<Map<String, Object>> updateFileLink(
            @PathVariable Long id,
            @RequestBody Map<String, Object> data) {
        try {
            Map<String, Object> result = fileLinkService.updateFileLink(id, data);
            return Result.success(result);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("更新文件链接失败: " + e.getMessage());
        }
    }

    @Operation(summary = "删除文件链接", description = "删除指定的文件链接")
    @DeleteMapping("/{id}")
    public Result<Void> deleteFileLink(@PathVariable Long id) {
        try {
            fileLinkService.deleteFileLink(id);
            return Result.success();
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("删除文件链接失败: " + e.getMessage());
        }
    }

    @Operation(summary = "批量删除文件链接", description = "批量删除文件链接")
    @PostMapping("/batch-delete")
    public Result<Map<String, Object>> batchDeleteFileLinks(@RequestBody List<Long> ids) {
        try {
            if (ids == null || ids.isEmpty()) {
                return Result.error("链接ID列表不能为空");
            }
            Map<String, Object> result = fileLinkService.batchDeleteFileLinks(ids);
            return Result.success(result);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("批量删除文件链接失败: " + e.getMessage());
        }
    }

    @Operation(summary = "检查链接状态", description = "检查链接是否可访问")
    @PostMapping("/{id}/check")
    public Result<Map<String, Object>> checkLinkStatus(@PathVariable Long id) {
        try {
            Map<String, Object> result = fileLinkService.checkLinkStatus(id);
            return Result.success(result);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("检查链接状态失败: " + e.getMessage());
        }
    }

    @Operation(summary = "获取分类列表", description = "获取指定库的分类列表")
    @GetMapping("/{libraryType}/categories")
    public Result<List<String>> getCategories(@PathVariable String libraryType) {
        try {
            List<String> result = fileLinkService.getCategories(libraryType);
            return Result.success(result);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("获取分类列表失败: " + e.getMessage());
        }
    }

    @Operation(summary = "获取上传统计", description = "获取文件上传统计信息")
    @GetMapping("/upload/stats")
    public Result<Map<String, Object>> getUploadStats() {
        try {
            Map<String, Object> result = fileLinkService.getUploadStats();
            return Result.success(result);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("获取上传统计失败: " + e.getMessage());
        }
    }

    @Operation(summary = "上传文件", description = "上传文件（简化实现）")
    @PostMapping("/upload")
    public Result<Map<String, Object>> uploadFile(
            @Parameter(description = "文件") @RequestParam("file") MultipartFile file,
            @Parameter(description = "标题") @RequestParam String title,
            @Parameter(description = "所属库类型") @RequestParam String library_type,
            @Parameter(description = "描述") @RequestParam(required = false) String description,
            @Parameter(description = "分类") @RequestParam(required = false) String category) {
        try {
            Map<String, Object> data = new java.util.HashMap<>();
            data.put("url", "file://" + file.getOriginalFilename());
            data.put("title", title);
            data.put("library_type", library_type);
            data.put("description", description);
            data.put("category", category);
            data.put("original_filename", file.getOriginalFilename());
            data.put("file_size", file.getSize());
            Map<String, Object> result = fileLinkService.createFileLink(data);
            return Result.success(result);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("上传文件失败: " + e.getMessage());
        }
    }
}
