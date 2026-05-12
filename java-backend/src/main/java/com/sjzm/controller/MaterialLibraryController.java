package com.sjzm.controller;

import com.sjzm.common.BusinessException;
import com.sjzm.common.PageResult;
import com.sjzm.common.Result;
import com.sjzm.entity.MaterialLibrary;
import com.sjzm.entity.MaterialLibraryRecycleBin;
import com.sjzm.service.MaterialLibraryImportService;
import com.sjzm.service.MaterialLibraryService;
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

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 素材库控制器
 */
@Slf4j
@Tag(name = "素材库管理", description = "素材 CRUD、批量操作、导入导出、回收站、元素词库")
@RestController
@RequestMapping("/api/v1/material-library")
@RequiredArgsConstructor
public class MaterialLibraryController {

    private final MaterialLibraryService materialLibraryService;
    private final MaterialLibraryImportService materialLibraryImportService;

    // ==================== 基础 CRUD ====================

    @Operation(summary = "获取素材列表", description = "分页查询素材，支持多条件筛选")
    @GetMapping
    public Result<PageResult<MaterialLibrary>> listMaterials(
            @Parameter(description = "页码") @RequestParam(defaultValue = "1") int page,
            @Parameter(description = "每页数量") @RequestParam(defaultValue = "20") int size,
            @Parameter(description = "搜索类型") @RequestParam(required = false) String searchType,
            @Parameter(description = "搜索内容") @RequestParam(required = false) String searchContent,
            @Parameter(description = "开发人筛选") @RequestParam(required = false) List<String> developer,
            @Parameter(description = "状态筛选") @RequestParam(required = false) List<String> status,
            @Parameter(description = "载体筛选") @RequestParam(required = false) List<String> carrier) {
        try {
            PageResult<MaterialLibrary> result = materialLibraryService.listMaterials(
                    page, size, searchType, searchContent, developer, status, carrier);
            return Result.success(result);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("获取素材列表失败: " + e.getMessage());
        }
    }

    @Operation(summary = "获取素材详情", description = "根据SKU获取素材详细信息")
    @GetMapping("/sku/{sku}")
    public Result<MaterialLibrary> getMaterial(@PathVariable String sku) {
        try {
            MaterialLibrary material = materialLibraryService.getMaterialBySku(sku);
            return Result.success(material);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("获取素材详情失败: " + e.getMessage());
        }
    }

    @Operation(summary = "创建素材", description = "创建新素材")
    @PostMapping
    public Result<MaterialLibrary> createMaterial(@RequestBody MaterialLibrary material) {
        try {
            MaterialLibrary created = materialLibraryService.createMaterial(material);
            return Result.success(created);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("创建素材失败: " + e.getMessage());
        }
    }

    @Operation(summary = "更新素材", description = "根据SKU更新素材信息")
    @PutMapping("/sku/{sku}")
    public Result<MaterialLibrary> updateMaterial(@PathVariable String sku, @RequestBody MaterialLibrary material) {
        try {
            MaterialLibrary existing = materialLibraryService.getMaterialBySku(sku);
            if (existing == null) {
                return Result.notFound("未找到SKU为 " + sku + " 的素材");
            }
            MaterialLibrary updated = materialLibraryService.updateMaterial(existing.getId(), material);
            return Result.success(updated);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("更新素材失败: " + e.getMessage());
        }
    }

    @Operation(summary = "删除素材", description = "根据SKU删除素材（移动到回收站）")
    @DeleteMapping("/sku/{sku}")
    public Result<Void> deleteMaterial(@PathVariable String sku) {
        try {
            MaterialLibrary existing = materialLibraryService.getMaterialBySku(sku);
            if (existing == null) {
                return Result.notFound("未找到SKU为 " + sku + " 的素材");
            }
            materialLibraryService.deleteMaterial(existing.getId());
            return Result.success();
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("删除素材失败: " + e.getMessage());
        }
    }

    // ==================== 批量操作 ====================

    @Operation(summary = "批量删除素材", description = "根据ID列表批量删除素材（移动到回收站）")
    @DeleteMapping("/batch")
    public Result<Map<String, Object>> batchDeleteMaterials(@RequestBody List<Long> ids) {
        try {
            Map<String, Object> result = materialLibraryService.batchDeleteMaterials(ids);
            return Result.success(result);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("批量删除素材失败: " + e.getMessage());
        }
    }

    @Operation(summary = "批量创建素材", description = "批量创建素材")
    @PostMapping("/batch-create")
    public Result<Map<String, Object>> batchCreateMaterials(@RequestBody List<MaterialLibrary> materials) {
        try {
            int successCount = 0;
            int failCount = 0;
            List<String> errors = new ArrayList<>();
            for (int i = 0; i < materials.size(); i++) {
                try {
                    materialLibraryService.createMaterial(materials.get(i));
                    successCount++;
                } catch (Exception e) {
                    failCount++;
                    errors.add("第" + (i + 1) + "条: " + e.getMessage());
                }
            }
            Map<String, Object> result = new HashMap<>();
            result.put("total", materials.size());
            result.put("successCount", successCount);
            result.put("failCount", failCount);
            if (!errors.isEmpty()) {
                result.put("errors", errors);
            }
            return Result.success(result);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("批量创建素材失败: " + e.getMessage());
        }
    }

    @Operation(summary = "批量更新素材", description = "批量更新素材信息")
    @PostMapping("/batch-update")
    public Result<Map<String, Object>> batchUpdateMaterials(@RequestBody List<MaterialLibrary> materials) {
        try {
            int successCount = 0;
            int failCount = 0;
            List<String> errors = new ArrayList<>();
            for (int i = 0; i < materials.size(); i++) {
                try {
                    MaterialLibrary ml = materials.get(i);
                    MaterialLibrary existing = materialLibraryService.getMaterialBySku(ml.getSku());
                    if (existing == null) {
                        failCount++;
                        errors.add("第" + (i + 1) + "条: 未找到SKU为 " + ml.getSku() + " 的素材");
                        continue;
                    }
                    materialLibraryService.updateMaterial(existing.getId(), ml);
                    successCount++;
                } catch (Exception e) {
                    failCount++;
                    errors.add("第" + (i + 1) + "条: " + e.getMessage());
                }
            }
            Map<String, Object> result = new HashMap<>();
            result.put("total", materials.size());
            result.put("successCount", successCount);
            result.put("failCount", failCount);
            if (!errors.isEmpty()) {
                result.put("errors", errors);
            }
            return Result.success(result);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("批量更新素材失败: " + e.getMessage());
        }
    }

    @Operation(summary = "批量导入素材", description = "批量导入素材数据")
    @PostMapping("/import")
    public Result<Map<String, Object>> batchImportMaterials(@RequestBody Map<String, Object> importRequest) {
        try {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> dataList = (List<Map<String, Object>>) importRequest.get("data");
            if (dataList == null || dataList.isEmpty()) {
                return Result.error("导入数据不能为空");
            }
            List<MaterialLibrary> materials = new ArrayList<>();
            for (Map<String, Object> item : dataList) {
                MaterialLibrary ml = new MaterialLibrary();
                if (item.get("sku") != null) ml.setSku(item.get("sku").toString());
                if (item.get("batch") != null) ml.setBatch(item.get("batch").toString());
                if (item.get("developer") != null) ml.setDeveloper(item.get("developer").toString());
                if (item.get("carrier") != null) ml.setCarrier(item.get("carrier").toString());
                if (item.get("element") != null) ml.setElement(item.get("element").toString());
                if (item.get("modificationRequirement") != null) ml.setModificationRequirement(item.get("modificationRequirement").toString());
                if (item.get("images") != null) ml.setImages(item.get("images").toString());
                if (item.get("referenceImages") != null) ml.setReferenceImages(item.get("referenceImages").toString());
                if (item.get("finalDraftImages") != null) ml.setFinalDraftImages(item.get("finalDraftImages").toString());
                if (item.get("status") != null) ml.setStatus(item.get("status").toString());
                materials.add(ml);
            }
            Map<String, Object> result = materialLibraryService.batchImportMaterials(materials);
            return Result.success(result);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("批量导入素材失败: " + e.getMessage());
        }
    }

    @Operation(summary = "Excel导入素材", description = "上传Excel文件批量导入素材")
    @PostMapping("/import/excel")
    public Result<Map<String, Object>> importFromExcel(
            @Parameter(description = "Excel文件(.xlsx/.xls)") @RequestParam("file") MultipartFile file,
            @Parameter(description = "是否覆盖已存在的SKU") @RequestParam(defaultValue = "false") boolean overwrite) {
        try {
            log.info("Excel导入素材: filename={}, size={}, overwrite={}",
                    file.getOriginalFilename(), file.getSize(), overwrite);
            Map<String, Object> result = materialLibraryImportService.importFromExcel(file, overwrite);
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("Excel导入素材失败: " + e.getMessage());
        }
    }

    @Operation(summary = "下载素材导入模板", description = "下载Excel导入模板文件")
    @GetMapping("/import/template")
    public ResponseEntity<byte[]> downloadImportTemplate() {
        try {
            byte[] template = materialLibraryImportService.generateImportTemplate();
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType(
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
            headers.setContentDispositionFormData("attachment", "material_library_import_template.xlsx");
            return ResponseEntity.ok().headers(headers).body(template);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("下载导入模板失败: " + e.getMessage());
        }
    }

    // ==================== 回收站 ====================

    @Operation(summary = "回收站列表", description = "获取回收站中的素材列表")
    @GetMapping("/recycle-bin")
    public Result<PageResult<MaterialLibraryRecycleBin>> listRecycleBin(
            @Parameter(description = "页码") @RequestParam(defaultValue = "1") int page,
            @Parameter(description = "每页数量") @RequestParam(defaultValue = "20") int size) {
        try {
            PageResult<MaterialLibraryRecycleBin> result = materialLibraryService.listRecycleBin(page, size);
            return Result.success(result);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("获取回收站列表失败: " + e.getMessage());
        }
    }

    @Operation(summary = "恢复素材", description = "从回收站恢复素材")
    @PostMapping("/recycle-bin/{sku}/restore")
    public Result<Void> restoreMaterial(@PathVariable String sku) {
        try {
            materialLibraryService.restoreMaterial(sku);
            return Result.success();
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("恢复素材失败: " + e.getMessage());
        }
    }

    @Operation(summary = "批量恢复素材", description = "从回收站批量恢复素材")
    @PostMapping("/recycle-bin/batch-restore")
    public Result<Map<String, Object>> batchRestoreMaterials(@RequestBody List<String> skus) {
        try {
            Map<String, Object> result = materialLibraryService.batchRestoreMaterials(skus);
            return Result.success(result);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("批量恢复素材失败: " + e.getMessage());
        }
    }

    @Operation(summary = "永久删除素材", description = "从回收站永久删除素材")
    @DeleteMapping("/recycle-bin/{sku}")
    public Result<Void> permanentDeleteMaterial(@PathVariable String sku) {
        try {
            materialLibraryService.permanentDeleteMaterial(sku);
            return Result.success();
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("永久删除素材失败: " + e.getMessage());
        }
    }

    @Operation(summary = "批量永久删除素材", description = "从回收站批量永久删除素材")
    @DeleteMapping("/recycle-bin/batch")
    public Result<Map<String, Object>> batchPermanentDeleteMaterials(@RequestBody List<String> skus) {
        try {
            Map<String, Object> result = materialLibraryService.batchPermanentDeleteMaterials(skus);
            return Result.success(result);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("批量永久删除素材失败: " + e.getMessage());
        }
    }

    @Operation(summary = "清空回收站", description = "清空回收站中的所有素材")
    @DeleteMapping("/recycle-bin/clear")
    public Result<Map<String, Object>> clearRecycleBin() {
        try {
            Map<String, Object> result = materialLibraryService.clearRecycleBin();
            return Result.success(result);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("清空回收站失败: " + e.getMessage());
        }
    }

    // ==================== 元素词库 ====================

    @Operation(summary = "获取元素词库", description = "获取素材元素词库列表")
    @GetMapping("/elements")
    public Result<List<String>> getElementTags() {
        try {
            List<String> elements = materialLibraryService.getElementTags();
            return Result.success(elements);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("获取元素词库失败: " + e.getMessage());
        }
    }

    @Operation(summary = "更新元素词库", description = "更新素材元素词库")
    @PutMapping("/elements")
    public Result<Map<String, Object>> updateElementTags(@RequestBody List<String> elements) {
        try {
            Map<String, Object> result = materialLibraryService.updateElementTags(elements);
            return Result.success(result);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("更新元素词库失败: " + e.getMessage());
        }
    }

    // ==================== AI分析（占位实现） ====================

    @Operation(summary = "AI分析图片", description = "使用AI分析图片内容，自动识别元素标签")
    @PostMapping("/analyze-image")
    public Result<Map<String, Object>> analyzeImage(@RequestBody Map<String, Object> request) {
        try {
            Map<String, Object> result = materialLibraryService.analyzeImage(request);
            return Result.success(result);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("AI分析图片失败: " + e.getMessage());
        }
    }

    @Operation(summary = "AI详细分析图片", description = "使用AI详细分析图片内容，使用腾讯云混元大模型")
    @PostMapping("/analyze-image-detailed")
    public Result<Map<String, Object>> analyzeImageDetailed(@RequestBody Map<String, Object> request) {
        try {
            Map<String, Object> result = materialLibraryService.analyzeImageDetailed(request);
            return Result.success(result);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("AI详细分析图片失败: " + e.getMessage());
        }
    }

    // ==================== 本地文件处理（占位实现） ====================

    @Operation(summary = "处理本地文件", description = "处理素材库本地文件")
    @PostMapping("/process-local-files")
    public Result<Map<String, Object>> processLocalFiles(@RequestBody Map<String, Object> request) {
        try {
            Map<String, Object> result = materialLibraryService.processLocalFiles(request);
            return Result.success(result);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("处理本地文件失败: " + e.getMessage());
        }
    }

    // ==================== 批次统计 ====================

    @Operation(summary = "获取批次数量", description = "获取指定批次的素材数量")
    @GetMapping("/batch/{batch}/count")
    public Result<Map<String, Object>> getBatchCount(@PathVariable String batch,
            @org.springframework.beans.factory.annotation.Autowired(required = false) com.sjzm.mapper.MaterialLibraryMapper materialLibraryMapper) {
        try {
            if (materialLibraryMapper == null) {
                Map<String, Object> result = new HashMap<>();
                result.put("batch", batch);
                result.put("count", 0);
                result.put("message", "Mapper未初始化");
                return Result.success(result);
            }
            Long count = materialLibraryMapper.selectCount(
                    new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<MaterialLibrary>()
                            .eq(MaterialLibrary::getBatch, batch));
            Map<String, Object> result = new HashMap<>();
            result.put("batch", batch);
            result.put("count", count);
            return Result.success(result);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("获取批次数量失败: " + e.getMessage());
        }
    }
}
