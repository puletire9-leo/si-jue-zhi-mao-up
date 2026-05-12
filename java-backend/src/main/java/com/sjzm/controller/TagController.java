package com.sjzm.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.sjzm.common.BusinessException;
import com.sjzm.common.PageResult;
import com.sjzm.common.Result;
import com.sjzm.entity.Product;
import com.sjzm.mapper.ProductMapper;
import com.sjzm.service.TagService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Tag(name = "标签管理", description = "标签 CRUD")
@RestController
@RequestMapping("/api/v1/tags")
@RequiredArgsConstructor
public class TagController {

    private final TagService tagService;
    private final ProductMapper productMapper;

    @Operation(summary = "获取标签列表", description = "分页查询标签")
    @GetMapping
    public Result<PageResult<com.sjzm.entity.Tag>> listTags(
            @Parameter(description = "页码") @RequestParam(defaultValue = "1") int page,
            @Parameter(description = "每页数量") @RequestParam(defaultValue = "20") int size,
            @Parameter(description = "搜索关键词") @RequestParam(required = false) String keyword,
            @Parameter(description = "标签类型") @RequestParam(required = false) String type) {
        try {
            PageResult<com.sjzm.entity.Tag> result = tagService.listTags(page, size, keyword, type);
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("获取标签列表失败: " + e.getMessage());
        }
    }

    @Operation(summary = "获取所有标签", description = "获取所有标签")
    @GetMapping("/all")
    public Result<List<com.sjzm.entity.Tag>> listAllTags() {
        try {
            List<com.sjzm.entity.Tag> result = tagService.listAllTags();
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("获取所有标签失败: " + e.getMessage());
        }
    }

    @Operation(summary = "获取标签详情", description = "根据ID获取标签详细信息")
    @GetMapping("/{id}")
    public Result<com.sjzm.entity.Tag> getTag(@PathVariable Long id) {
        try {
            com.sjzm.entity.Tag result = tagService.getTagById(id);
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("获取标签详情失败: " + e.getMessage());
        }
    }

    @Operation(summary = "创建标签", description = "创建新标签")
    @PostMapping
    public Result<com.sjzm.entity.Tag> createTag(@RequestBody com.sjzm.entity.Tag tag) {
        try {
            com.sjzm.entity.Tag result = tagService.createTag(tag);
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("创建标签失败: " + e.getMessage());
        }
    }

    @Operation(summary = "更新标签", description = "根据ID更新标签信息")
    @PutMapping("/{id}")
    public Result<com.sjzm.entity.Tag> updateTag(@PathVariable Long id, @RequestBody com.sjzm.entity.Tag tag) {
        try {
            com.sjzm.entity.Tag result = tagService.updateTag(id, tag);
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("更新标签失败: " + e.getMessage());
        }
    }

    @Operation(summary = "删除标签", description = "根据ID删除标签（逻辑删除）")
    @DeleteMapping("/{id}")
    public Result<Void> deleteTag(@PathVariable Long id) {
        try {
            tagService.deleteTag(id);
            return Result.success();
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("删除标签失败: " + e.getMessage());
        }
    }

    @Operation(summary = "获取标签下的产品", description = "根据标签ID获取产品列表")
    @GetMapping("/{id}/products")
    public Result<PageResult<Product>> getTagProducts(
            @PathVariable Long id,
            @Parameter(description = "页码") @RequestParam(defaultValue = "1") int page,
            @Parameter(description = "每页数量") @RequestParam(defaultValue = "20") int size) {
        try {
            com.sjzm.entity.Tag tag = tagService.getTagById(id);
            if (tag == null) {
                throw new BusinessException(404, "标签不存在: " + id);
            }
            String tagName = tag.getName();
            Page<Product> productPage = productMapper.selectPage(
                    new Page<>(page, size),
                    new LambdaQueryWrapper<Product>().like(Product::getTags, tagName)
            );
            PageResult<Product> result = PageResult.of(
                    productPage.getRecords(),
                    productPage.getTotal(),
                    productPage.getCurrent(),
                    productPage.getSize()
            );
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("获取标签下的产品失败: " + e.getMessage());
        }
    }

    @Operation(summary = "批量更新标签", description = "批量更新标签信息")
    @PutMapping("/batch")
    public Result<Map<String, Object>> batchUpdateTags(@RequestBody List<com.sjzm.entity.Tag> tags) {
        try {
            int successCount = 0;
            int failCount = 0;
            List<String> errors = new ArrayList<>();
            for (int i = 0; i < tags.size(); i++) {
                try {
                    com.sjzm.entity.Tag item = tags.get(i);
                    if (item.getId() == null) {
                        failCount++;
                        errors.add("第" + (i + 1) + "条更新失败: 缺少ID");
                        continue;
                    }
                    tagService.updateTag(item.getId(), item);
                    successCount++;
                } catch (Exception e) {
                    failCount++;
                    errors.add("第" + (i + 1) + "条更新失败: " + e.getMessage());
                }
            }
            Map<String, Object> result = new HashMap<>();
            result.put("total", tags.size());
            result.put("successCount", successCount);
            result.put("failCount", failCount);
            result.put("errors", errors);
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("批量更新标签失败: " + e.getMessage());
        }
    }

    @Operation(summary = "批量删除标签", description = "批量删除多个标签")
    @DeleteMapping("/batch")
    public Result<Map<String, Object>> batchDeleteTags(@RequestBody List<Long> ids) {
        try {
            if (ids == null || ids.isEmpty()) {
                throw new BusinessException("标签ID列表不能为空");
            }
            int successCount = 0;
            int failCount = 0;
            List<String> errors = new ArrayList<>();
            for (Long id : ids) {
                try {
                    tagService.deleteTag(id);
                    successCount++;
                } catch (Exception e) {
                    failCount++;
                    errors.add("ID " + id + ": " + e.getMessage());
                }
            }
            Map<String, Object> result = new HashMap<>();
            result.put("total", ids.size());
            result.put("successCount", successCount);
            result.put("failCount", failCount);
            result.put("errors", errors);
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("批量删除标签失败: " + e.getMessage());
        }
    }

    @Operation(summary = "批量创建标签", description = "批量创建多个标签")
    @PostMapping("/batch")
    public Result<Map<String, Object>> batchCreateTags(@RequestBody List<com.sjzm.entity.Tag> tags) {
        try {
            if (tags == null || tags.isEmpty()) {
                throw new BusinessException("标签列表不能为空");
            }
            int successCount = 0;
            int failCount = 0;
            int duplicateCount = 0;
            List<String> errors = new ArrayList<>();
            List<com.sjzm.entity.Tag> createdTags = new ArrayList<>();
            for (int i = 0; i < tags.size(); i++) {
                try {
                    com.sjzm.entity.Tag item = tags.get(i);
                    if (!org.springframework.util.StringUtils.hasText(item.getName())) {
                        failCount++;
                        errors.add("第" + (i + 1) + "条创建失败: 标签名称不能为空");
                        continue;
                    }
                    com.sjzm.entity.Tag created = tagService.createTag(item);
                    createdTags.add(created);
                    successCount++;
                } catch (Exception e) {
                    String message = e.getMessage();
                    if (message != null && message.contains("已存在")) {
                        duplicateCount++;
                        errors.add("第" + (i + 1) + "条: 标签已存在");
                    } else {
                        failCount++;
                        errors.add("第" + (i + 1) + "条创建失败: " + message);
                    }
                }
            }
            Map<String, Object> result = new HashMap<>();
            result.put("total", tags.size());
            result.put("successCount", successCount);
            result.put("failCount", failCount);
            result.put("duplicateCount", duplicateCount);
            result.put("errors", errors.size() > 10 ? errors.subList(0, 10) : errors);
            result.put("createdTags", createdTags);
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("批量创建标签失败: " + e.getMessage());
        }
    }
}
