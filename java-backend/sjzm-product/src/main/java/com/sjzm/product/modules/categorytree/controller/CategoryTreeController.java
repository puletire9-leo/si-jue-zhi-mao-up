package com.sjzm.product.modules.categorytree.controller;

import com.sjzm.common.Result;
import com.sjzm.product.modules.categorytree.service.CategoryTreeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 新品榜类目树模块。
 * 前缀 /api/v1/modules/category-tree（网关 + nginx 已覆盖 /modules/**）。
 * 数据源 competitor_products（source=新品榜），按 node_label_path 构建完整层级树。
 */
@RestController
@RequestMapping("/api/v1/modules/category-tree")
@RequiredArgsConstructor
@Tag(name = "新品榜类目树", description = "按国家汇总新品榜大类/小类，构建完整层级树")
public class CategoryTreeController {

    private final CategoryTreeService service;

    @GetMapping("/tree")
    @Operation(summary = "取某站点完整类目树（嵌套，按商品数降序）")
    public Result<Map<String, Object>> tree(@RequestParam String marketplace) {
        return Result.success(service.getTree(marketplace));
    }

    @GetMapping("/top")
    @Operation(summary = "取某站点顶层大类（概览/懒加载用）")
    public Result<List<Map<String, Object>>> top(@RequestParam String marketplace) {
        return Result.success(service.getTopCategories(marketplace));
    }

    @PostMapping("/refresh")
    @Operation(summary = "重建某站点类目树（从竞品表新品榜数据）")
    public Result<Integer> refresh(@RequestParam String marketplace) {
        return Result.success(service.refresh(marketplace));
    }

    @PostMapping("/refresh-all")
    @Operation(summary = "重建所有站点类目树")
    public Result<Map<String, Integer>> refreshAll() {
        return Result.success(service.refreshAll());
    }
}
