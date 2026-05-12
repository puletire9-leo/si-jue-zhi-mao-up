package com.sjzm.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sjzm.common.BusinessException;
import com.sjzm.common.PageResult;
import com.sjzm.common.Result;
import com.sjzm.entity.Selection;
import com.sjzm.mapper.SelectionMapper;
import com.sjzm.service.SelectionImportService;
import com.sjzm.service.SelectionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.*;
import java.util.stream.Collectors;

/**
 * 选品管理控制器
 */
@Slf4j
@Tag(name = "选品管理", description = "选品 CRUD、批量操作、统计")
@RestController
@RequestMapping("/api/v1/selection")
@RequiredArgsConstructor
public class SelectionController {

    private final SelectionService selectionService;
    private final SelectionMapper selectionMapper;
    private final SelectionImportService selectionImportService;

    @Operation(summary = "获取选品列表（产品列表）", description = "分页查询选品，支持多条件筛选")
    @GetMapping("/products/list")
    public Result<PageResult<Selection>> listProducts(
            @Parameter(description = "页码") @RequestParam(defaultValue = "1") int page,
            @Parameter(description = "每页数量") @RequestParam(defaultValue = "20") int size,
            @Parameter(description = "搜索关键词") @RequestParam(required = false) String keyword,
            @Parameter(description = "产品类型") @RequestParam(required = false) String productType,
            @Parameter(description = "来源") @RequestParam(required = false) String source,
            @Parameter(description = "国家") @RequestParam(required = false) String country,
            @Parameter(description = "数据筛选模式") @RequestParam(required = false) String dataFilterMode) {
        PageResult<Selection> result = selectionService.listSelections(page, size, keyword, productType, source, country, dataFilterMode);
        return Result.success(result);
    }

    @Operation(summary = "获取新品列表", description = "分页查询新品，支持多条件筛选")
    @GetMapping("/new/list")
    public Result<PageResult<Selection>> listNewProducts(
            @Parameter(description = "页码") @RequestParam(defaultValue = "1") int page,
            @Parameter(description = "每页数量") @RequestParam(defaultValue = "20") int size,
            @Parameter(description = "搜索关键词") @RequestParam(required = false) String keyword,
            @Parameter(description = "产品类型") @RequestParam(required = false) String productType,
            @Parameter(description = "来源") @RequestParam(required = false) String source,
            @Parameter(description = "国家") @RequestParam(required = false) String country,
            @Parameter(description = "数据筛选模式") @RequestParam(required = false) String dataFilterMode) {
        PageResult<Selection> result = selectionService.listSelections(page, size, keyword, "new", source, country, dataFilterMode);
        return Result.success(result);
    }

    @Operation(summary = "获取参考图列表", description = "分页查询参考图，支持多条件筛选")
    @GetMapping("/reference/list")
    public Result<PageResult<Selection>> listReferenceProducts(
            @Parameter(description = "页码") @RequestParam(defaultValue = "1") int page,
            @Parameter(description = "每页数量") @RequestParam(defaultValue = "20") int size,
            @Parameter(description = "搜索关键词") @RequestParam(required = false) String keyword,
            @Parameter(description = "产品类型") @RequestParam(required = false) String productType,
            @Parameter(description = "来源") @RequestParam(required = false) String source,
            @Parameter(description = "国家") @RequestParam(required = false) String country,
            @Parameter(description = "数据筛选模式") @RequestParam(required = false) String dataFilterMode) {
        PageResult<Selection> result = selectionService.listSelections(page, size, keyword, "reference", source, country, dataFilterMode);
        return Result.success(result);
    }

    @Operation(summary = "获取全部选品列表", description = "分页查询全部选品，支持多条件筛选")
    @GetMapping("/all/list")
    public Result<PageResult<Selection>> listAllSelections(
            @Parameter(description = "页码") @RequestParam(defaultValue = "1") int page,
            @Parameter(description = "每页数量") @RequestParam(defaultValue = "20") int size,
            @Parameter(description = "搜索关键词") @RequestParam(required = false) String keyword,
            @Parameter(description = "产品类型") @RequestParam(required = false) String productType,
            @Parameter(description = "来源") @RequestParam(required = false) String source,
            @Parameter(description = "国家") @RequestParam(required = false) String country,
            @Parameter(description = "数据筛选模式") @RequestParam(required = false) String dataFilterMode) {
        PageResult<Selection> result = selectionService.listSelections(page, size, keyword, productType, source, country, dataFilterMode);
        return Result.success(result);
    }

    @Operation(summary = "获取选品详情", description = "根据ID获取选品详细信息")
    @GetMapping("/{id}")
    public Result<Selection> getSelection(@PathVariable Long id) {
        Selection selection = selectionService.getSelectionById(id);
        return Result.success(selection);
    }

    @Operation(summary = "创建选品", description = "创建新选品")
    @PostMapping
    public Result<Selection> createSelection(@RequestBody Selection selection) {
        Selection created = selectionService.createSelection(selection);
        return Result.success(created);
    }

    @Operation(summary = "更新选品", description = "根据ID更新选品信息")
    @PutMapping("/{id}")
    public Result<Selection> updateSelection(@PathVariable Long id, @RequestBody Selection selection) {
        Selection updated = selectionService.updateSelection(id, selection);
        return Result.success(updated);
    }

    @Operation(summary = "删除选品", description = "根据ID删除选品（逻辑删除）")
    @DeleteMapping("/{id}")
    public Result<Void> deleteSelection(@PathVariable Long id) {
        selectionService.deleteSelection(id);
        return Result.success();
    }

    @Operation(summary = "批量删除选品", description = "根据ID列表批量删除选品")
    @DeleteMapping("/batch")
    public Result<Map<String, Object>> batchDeleteSelections(@RequestBody List<Long> ids) {
        Map<String, Object> result = selectionService.batchDeleteSelections(ids);
        return Result.success(result);
    }

    @Operation(summary = "批量导入选品", description = "批量导入选品数据")
    @PostMapping("/import")
    @SuppressWarnings("unchecked")
    public Result<Map<String, Object>> batchImportSelections(@RequestBody Map<String, Object> importRequest) {
        List<Selection> selections = (List<Selection>) importRequest.get("selections");
        boolean overwrite = Boolean.TRUE.equals(importRequest.get("overwrite"));
        Map<String, Object> result = selectionService.batchImportSelections(selections, overwrite);
        return Result.success(result);
    }

    @Operation(summary = "Excel导入选品", description = "上传Excel文件批量导入选品")
    @PostMapping("/import/excel")
    public Result<Map<String, Object>> importFromExcel(
            @Parameter(description = "Excel文件(.xlsx/.xls)") @RequestParam("file") MultipartFile file,
            @Parameter(description = "是否覆盖已存在的ASIN") @RequestParam(defaultValue = "false") boolean overwrite) {
        try {
            log.info("Excel导入选品: filename={}, size={}, overwrite={}",
                    file.getOriginalFilename(), file.getSize(), overwrite);
            Map<String, Object> result = selectionImportService.importFromExcel(file, overwrite);
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("Excel导入选品失败: " + e.getMessage());
        }
    }

    @Operation(summary = "下载选品导入模板", description = "下载Excel导入模板文件")
    @GetMapping("/import/template")
    public ResponseEntity<byte[]> downloadImportTemplate() {
        try {
            byte[] template = selectionImportService.generateImportTemplate();
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType(
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
            headers.setContentDispositionFormData("attachment", "selection_import_template.xlsx");
            return ResponseEntity.ok().headers(headers).body(template);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("下载导入模板失败: " + e.getMessage());
        }
    }

    @Operation(summary = "获取选品统计", description = "获取选品统计数据")
    @GetMapping("/stats")
    public Result<Map<String, Object>> getSelectionStats() {
        Map<String, Object> stats = selectionService.getSelectionStats();
        return Result.success(stats);
    }

    @Operation(summary = "批量删除选品产品", description = "根据ID列表批量删除选品产品")
    @PostMapping("/products/batch-delete")
    public Result<Map<String, Object>> batchDeleteProducts(@RequestBody List<Long> ids) {
        Map<String, Object> result = selectionService.batchDeleteSelections(ids);
        return Result.success(result);
    }

    @Operation(summary = "批量更新选品", description = "根据选品列表批量更新选品信息")
    @PutMapping("/batch-update")
    public Result<Map<String, Object>> batchUpdateSelections(@RequestBody List<Selection> selections) {
        Map<String, Object> result = selectionService.batchUpdateSelections(selections);
        return Result.success(result);
    }

    @Operation(summary = "批量更新选品标签", description = "根据ID列表批量更新选品标签")
    @PutMapping("/batch-update/tags")
    public Result<Map<String, Object>> batchUpdateTags(
            @RequestBody Map<String, Object> request) {
        @SuppressWarnings("unchecked")
        List<Long> ids = (List<Long>) request.get("ids");
        String tags = (String) request.get("tags");
        Map<String, Object> result = selectionService.batchUpdateTags(ids, tags);
        return Result.success(result);
    }

    @Operation(summary = "批量更新选品备注", description = "根据ID列表批量更新选品备注")
    @PutMapping("/batch-update/notes")
    public Result<Map<String, Object>> batchUpdateNotes(
            @RequestBody Map<String, Object> request) {
        @SuppressWarnings("unchecked")
        List<Long> ids = (List<Long>) request.get("ids");
        String notes = (String) request.get("notes");
        Map<String, Object> result = selectionService.batchUpdateNotes(ids, notes);
        return Result.success(result);
    }

    @Operation(summary = "批量更新选品评分", description = "根据ID列表批量更新选品评分和等级")
    @PutMapping("/batch-update/scores")
    public Result<Map<String, Object>> batchUpdateScores(
            @RequestBody Map<String, Object> request) {
        @SuppressWarnings("unchecked")
        List<Long> ids = (List<Long>) request.get("ids");
        Double score = request.get("score") != null ? ((Number) request.get("score")).doubleValue() : null;
        String grade = (String) request.get("grade");
        Map<String, Object> result = selectionService.batchUpdateScores(ids, score, grade);
        return Result.success(result);
    }

    @Operation(summary = "获取店铺列表", description = "获取所有店铺列表")
    @GetMapping("/stores")
    public Result<List<Map<String, Object>>> getStores() {
        LambdaQueryWrapper<Selection> wrapper = new LambdaQueryWrapper<>();
        wrapper.select(Selection::getStoreName)
                .isNotNull(Selection::getStoreName)
                .ne(Selection::getStoreName, "")
                .groupBy(Selection::getStoreName);
        List<Selection> selections = selectionMapper.selectList(wrapper);
        List<Map<String, Object>> stores = selections.stream()
                .map(s -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("name", s.getStoreName());
                    return map;
                })
                .collect(Collectors.toList());
        return Result.success(stores);
    }

    @Operation(summary = "获取分类统计", description = "获取分类统计数据")
    @GetMapping("/categories")
    public Result<List<Map<String, Object>>> getCategories() {
        LambdaQueryWrapper<Selection> wrapper = new LambdaQueryWrapper<>();
        wrapper.select(Selection::getMainCategoryName)
                .isNotNull(Selection::getMainCategoryName)
                .ne(Selection::getMainCategoryName, "");
        List<Selection> selections = selectionMapper.selectList(wrapper);
        Map<String, Long> categoryCountMap = selections.stream()
                .collect(Collectors.groupingBy(Selection::getMainCategoryName, Collectors.counting()));
        List<Map<String, Object>> categories = categoryCountMap.entrySet().stream()
                .map(entry -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("name", entry.getKey());
                    map.put("count", entry.getValue());
                    return map;
                })
                .collect(Collectors.toList());
        return Result.success(categories);
    }

    @Operation(summary = "下载导入模板", description = "下载选品导入模板")
    @GetMapping("/template")
    public Result<Map<String, Object>> downloadTemplate() {
        Map<String, Object> template = new LinkedHashMap<>();
        template.put("name", "选品导入模板");
        template.put("description", "用于批量导入选品数据的模板");
        List<Map<String, String>> columns = new ArrayList<>();
        columns.add(createColumn("asin", "产品ASIN", "必填"));
        columns.add(createColumn("productTitle", "商品标题", "选填"));
        columns.add(createColumn("price", "商品价格", "选填"));
        columns.add(createColumn("imageUrl", "商品图片URL", "选填"));
        columns.add(createColumn("storeName", "店铺名称", "选填"));
        columns.add(createColumn("storeUrl", "店铺URL", "选填"));
        columns.add(createColumn("mainCategoryName", "大类榜单名", "选填"));
        columns.add(createColumn("mainCategoryRank", "榜单排名", "选填"));
        columns.add(createColumn("productLink", "商品链接", "选填"));
        columns.add(createColumn("source", "来源", "选填"));
        columns.add(createColumn("country", "国家", "选填"));
        columns.add(createColumn("productType", "产品类型(new/reference)", "选填"));
        columns.add(createColumn("tags", "标签(JSON)", "选填"));
        columns.add(createColumn("notes", "备注", "选填"));
        template.put("columns", columns);
        return Result.success(template);
    }

    @Operation(summary = "清空所有选品", description = "清空所有选品数据")
    @DeleteMapping("/products/clear-all")
    public Result<Void> clearAllProducts() {
        selectionMapper.delete(new LambdaQueryWrapper<>());
        return Result.success();
    }

    @Operation(summary = "获取所有ASIN列表", description = "获取所有选品的ASIN列表")
    @GetMapping("/products/asins")
    public Result<List<String>> getAllAsins() {
        LambdaQueryWrapper<Selection> wrapper = new LambdaQueryWrapper<>();
        wrapper.select(Selection::getAsin)
                .isNotNull(Selection::getAsin)
                .ne(Selection::getAsin, "");
        List<Selection> selections = selectionMapper.selectList(wrapper);
        List<String> asinList = selections.stream()
                .map(Selection::getAsin)
                .distinct()
                .collect(Collectors.toList());
        return Result.success(asinList);
    }

    @Operation(summary = "导出ASIN", description = "导出ASIN数据")
    @PostMapping("/products/export-asins")
    public Result<Map<String, Object>> exportAsins(@RequestBody(required = false) List<Long> ids) {
        List<String> asins;
        if (ids != null && !ids.isEmpty()) {
            LambdaQueryWrapper<Selection> wrapper = new LambdaQueryWrapper<>();
            wrapper.in(Selection::getId, ids)
                    .select(Selection::getAsin)
                    .isNotNull(Selection::getAsin)
                    .ne(Selection::getAsin, "");
            List<Selection> selections = selectionMapper.selectList(wrapper);
            asins = selections.stream()
                    .map(Selection::getAsin)
                    .distinct()
                    .collect(Collectors.toList());
        } else {
            LambdaQueryWrapper<Selection> wrapper = new LambdaQueryWrapper<>();
            wrapper.select(Selection::getAsin)
                    .isNotNull(Selection::getAsin)
                    .ne(Selection::getAsin, "");
            List<Selection> selections = selectionMapper.selectList(wrapper);
            asins = selections.stream()
                    .map(Selection::getAsin)
                    .distinct()
                    .collect(Collectors.toList());
        }
        Map<String, Object> result = new HashMap<>();
        result.put("asins", asins);
        result.put("total", asins.size());
        return Result.success(result);
    }

    private Map<String, String> createColumn(String field, String label, String required) {
        Map<String, String> column = new LinkedHashMap<>();
        column.put("field", field);
        column.put("label", label);
        column.put("required", required);
        return column;
    }
}
