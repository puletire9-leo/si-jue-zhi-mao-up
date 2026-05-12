package com.sjzm.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.sjzm.common.BusinessException;
import com.sjzm.common.PageResult;
import com.sjzm.common.Result;
import com.sjzm.entity.Category;
import com.sjzm.entity.Product;
import com.sjzm.mapper.ProductMapper;
import com.sjzm.service.CategoryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 分类管理控制器
 */
@Tag(name = "分类管理", description = "分类 CRUD、树形结构")
@RestController
@RequestMapping("/api/v1/categories")
@RequiredArgsConstructor
public class CategoryController {

    private final CategoryService categoryService;
    private final ProductMapper productMapper;

    @Operation(summary = "获取分类列表", description = "分页查询分类")
    @GetMapping
    public Result<PageResult<Category>> listCategories(
            @Parameter(description = "页码") @RequestParam(defaultValue = "1") int page,
            @Parameter(description = "每页数量") @RequestParam(defaultValue = "20") int size,
            @Parameter(description = "搜索关键词") @RequestParam(required = false) String keyword) {
        try {
            PageResult<Category> result = categoryService.listCategories(page, size, keyword);
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("获取分类列表失败: " + e.getMessage());
        }
    }

    @Operation(summary = "获取所有分类", description = "获取所有分类（树形结构）")
    @GetMapping("/all")
    public Result<List<Category>> listAllCategories() {
        try {
            List<Category> result = categoryService.listAllCategories();
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("获取所有分类失败: " + e.getMessage());
        }
    }

    @Operation(summary = "获取分类详情", description = "根据ID获取分类详细信息")
    @GetMapping("/{id}")
    public Result<Category> getCategory(@PathVariable Long id) {
        try {
            Category result = categoryService.getCategoryById(id);
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("获取分类详情失败: " + e.getMessage());
        }
    }

    @Operation(summary = "创建分类", description = "创建新分类")
    @PostMapping
    public Result<Category> createCategory(@RequestBody Category category) {
        try {
            Category result = categoryService.createCategory(category);
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("创建分类失败: " + e.getMessage());
        }
    }

    @Operation(summary = "更新分类", description = "根据ID更新分类信息")
    @PutMapping("/{id}")
    public Result<Category> updateCategory(@PathVariable Long id, @RequestBody Category category) {
        try {
            Category result = categoryService.updateCategory(id, category);
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("更新分类失败: " + e.getMessage());
        }
    }

    @Operation(summary = "删除分类", description = "根据ID删除分类（逻辑删除）")
    @DeleteMapping("/{id}")
    public Result<Void> deleteCategory(@PathVariable Long id) {
        try {
            categoryService.deleteCategory(id);
            return Result.success();
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("删除分类失败: " + e.getMessage());
        }
    }

    @Operation(summary = "获取分类下的产品", description = "根据分类ID获取产品列表")
    @GetMapping("/{id}/products")
    public Result<PageResult<Product>> getCategoryProducts(
            @PathVariable Long id,
            @Parameter(description = "页码") @RequestParam(defaultValue = "1") int page,
            @Parameter(description = "每页数量") @RequestParam(defaultValue = "20") int size) {
        try {
            Category category = categoryService.getCategoryById(id);
            if (category == null) {
                throw new BusinessException(404, "分类不存在: " + id);
            }
            String categoryName = category.getName();
            Page<Product> productPage = productMapper.selectPage(
                    new Page<>(page, size),
                    new LambdaQueryWrapper<Product>().eq(Product::getCategory, categoryName)
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
            throw new BusinessException("获取分类下的产品失败: " + e.getMessage());
        }
    }
}
