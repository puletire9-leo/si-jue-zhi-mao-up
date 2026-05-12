package com.sjzm.controller;

import com.sjzm.common.BusinessException;
import com.sjzm.common.PageResult;
import com.sjzm.common.Result;
import com.sjzm.entity.CarrierLibrary;
import com.sjzm.entity.CarrierLibraryRecycleBin;
import com.sjzm.service.CarrierLibraryImportService;
import com.sjzm.service.CarrierLibraryService;
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
 * 运营商库控制器
 */
@Slf4j
@Tag(name = "运营商库管理", description = "运营商 CRUD、批量操作、导入导出、回收站")
@RestController
@RequestMapping("/api/v1/carrier-library")
@RequiredArgsConstructor
public class CarrierLibraryController {

    private final CarrierLibraryService carrierLibraryService;
    private final CarrierLibraryImportService carrierLibraryImportService;

    // ==================== 基础 CRUD ====================

    @Operation(summary = "获取运营商列表", description = "分页查询运营商，支持多条件筛选")
    @GetMapping
    public Result<PageResult<CarrierLibrary>> listCarriers(
            @Parameter(description = "页码") @RequestParam(defaultValue = "1") int page,
            @Parameter(description = "每页数量") @RequestParam(defaultValue = "20") int size,
            @Parameter(description = "搜索类型") @RequestParam(required = false) String searchType,
            @Parameter(description = "搜索内容") @RequestParam(required = false) String searchContent,
            @Parameter(description = "开发人筛选") @RequestParam(required = false) List<String> developer,
            @Parameter(description = "载体筛选") @RequestParam(required = false) List<String> carrier) {
        try {
            PageResult<CarrierLibrary> result = carrierLibraryService.listCarriers(
                    page, size, searchType, searchContent, developer, carrier);
            return Result.success(result);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("获取运营商列表失败: " + e.getMessage());
        }
    }

    @Operation(summary = "获取运营商详情", description = "根据SKU获取运营商详细信息")
    @GetMapping("/{sku}")
    public Result<CarrierLibrary> getCarrier(@PathVariable String sku) {
        try {
            CarrierLibrary result = carrierLibraryService.getCarrierBySku(sku);
            return Result.success(result);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("获取运营商详情失败: " + e.getMessage());
        }
    }

    @Operation(summary = "创建运营商", description = "创建新运营商")
    @PostMapping
    public Result<CarrierLibrary> createCarrier(@RequestBody CarrierLibrary carrier) {
        try {
            CarrierLibrary result = carrierLibraryService.createCarrier(carrier);
            return Result.success(result);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("创建运营商失败: " + e.getMessage());
        }
    }

    @Operation(summary = "更新运营商", description = "根据SKU更新运营商信息")
    @PutMapping("/{sku}")
    public Result<CarrierLibrary> updateCarrier(@PathVariable String sku, @RequestBody CarrierLibrary carrier) {
        try {
            CarrierLibrary existing = carrierLibraryService.getCarrierBySku(sku);
            if (existing == null) {
                return Result.notFound("运营商不存在: " + sku);
            }
            CarrierLibrary result = carrierLibraryService.updateCarrier(existing.getId(), carrier);
            return Result.success(result);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("更新运营商失败: " + e.getMessage());
        }
    }

    @Operation(summary = "删除运营商", description = "根据SKU删除运营商（移动到回收站）")
    @DeleteMapping("/{sku}")
    public Result<Void> deleteCarrier(@PathVariable String sku) {
        try {
            CarrierLibrary existing = carrierLibraryService.getCarrierBySku(sku);
            if (existing == null) {
                return Result.notFound("运营商不存在: " + sku);
            }
            carrierLibraryService.deleteCarrier(existing.getId());
            return Result.success();
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("删除运营商失败: " + e.getMessage());
        }
    }

    // ==================== 批量操作 ====================

    @Operation(summary = "批量删除运营商", description = "根据ID列表批量删除运营商（移动到回收站）")
    @DeleteMapping("/batch")
    public Result<Map<String, Object>> batchDeleteCarriers(@RequestBody List<Long> ids) {
        try {
            Map<String, Object> result = carrierLibraryService.batchDeleteCarriers(ids);
            return Result.success(result);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("批量删除运营商失败: " + e.getMessage());
        }
    }

    @Operation(summary = "批量导入运营商", description = "批量导入运营商数据")
    @PostMapping("/import")
    public Result<Map<String, Object>> batchImportCarriers(@RequestBody Map<String, Object> importRequest) {
        try {
            @SuppressWarnings("unchecked")
            List<CarrierLibrary> carriers = (List<CarrierLibrary>) importRequest.get("carriers");
            if (carriers == null || carriers.isEmpty()) {
                return Result.error("导入数据不能为空");
            }
            Map<String, Object> result = carrierLibraryService.batchImportCarriers(carriers);
            return Result.success(result);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("批量导入运营商失败: " + e.getMessage());
        }
    }

    @Operation(summary = "批量创建运营商", description = "批量创建运营商")
    @PostMapping("/batch-create")
    public Result<Map<String, Object>> batchCreateCarriers(@RequestBody List<CarrierLibrary> carriers) {
        try {
            int successCount = 0;
            int failCount = 0;
            List<String> errors = new ArrayList<>();
            for (int i = 0; i < carriers.size(); i++) {
                try {
                    carrierLibraryService.createCarrier(carriers.get(i));
                    successCount++;
                } catch (Exception e) {
                    failCount++;
                    errors.add("第" + (i + 1) + "条创建失败: " + e.getMessage());
                }
            }
            Map<String, Object> result = new HashMap<>();
            result.put("total", carriers.size());
            result.put("successCount", successCount);
            result.put("failCount", failCount);
            result.put("errors", errors);
            return Result.success(result);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("批量创建运营商失败: " + e.getMessage());
        }
    }

    @Operation(summary = "批量更新运营商", description = "批量更新运营商信息")
    @PostMapping("/batch-update")
    public Result<Map<String, Object>> batchUpdateCarriers(@RequestBody List<CarrierLibrary> carriers) {
        try {
            int successCount = 0;
            int failCount = 0;
            List<String> errors = new ArrayList<>();
            for (int i = 0; i < carriers.size(); i++) {
                try {
                    CarrierLibrary item = carriers.get(i);
                    if (item.getId() == null) {
                        failCount++;
                        errors.add("第" + (i + 1) + "条更新失败: 缺少ID");
                        continue;
                    }
                    carrierLibraryService.updateCarrier(item.getId(), item);
                    successCount++;
                } catch (Exception e) {
                    failCount++;
                    errors.add("第" + (i + 1) + "条更新失败: " + e.getMessage());
                }
            }
            Map<String, Object> result = new HashMap<>();
            result.put("total", carriers.size());
            result.put("successCount", successCount);
            result.put("failCount", failCount);
            result.put("errors", errors);
            return Result.success(result);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("批量更新运营商失败: " + e.getMessage());
        }
    }

    // ==================== Excel导入导出 ====================

    @Operation(summary = "Excel导入运营商", description = "上传Excel文件批量导入运营商")
    @PostMapping("/import/excel")
    public Result<Map<String, Object>> importFromExcel(
            @Parameter(description = "Excel文件(.xlsx/.xls)") @RequestParam("file") MultipartFile file,
            @Parameter(description = "是否覆盖已存在的SKU") @RequestParam(defaultValue = "false") boolean overwrite) {
        try {
            log.info("Excel导入运营商: filename={}, size={}, overwrite={}",
                    file.getOriginalFilename(), file.getSize(), overwrite);
            Map<String, Object> result = carrierLibraryImportService.importFromExcel(file, overwrite);
            return Result.success(result);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("Excel导入运营商失败: " + e.getMessage());
        }
    }

    @Operation(summary = "下载运营商导入模板", description = "下载Excel导入模板文件")
    @GetMapping("/import/template")
    public ResponseEntity<byte[]> downloadImportTemplate() {
        try {
            byte[] template = carrierLibraryImportService.generateImportTemplate();
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType(
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
            headers.setContentDispositionFormData("attachment", "carrier_library_import_template.xlsx");
            return ResponseEntity.ok().headers(headers).body(template);
        } catch (BusinessException e) {
            return ResponseEntity.status(500).body(null);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(null);
        }
    }

    // ==================== 回收站 ====================

    @Operation(summary = "回收站列表", description = "获取回收站中的运营商列表")
    @GetMapping("/recycle-bin")
    public Result<PageResult<CarrierLibraryRecycleBin>> listRecycleBin(
            @Parameter(description = "页码") @RequestParam(defaultValue = "1") int page,
            @Parameter(description = "每页数量") @RequestParam(defaultValue = "20") int size) {
        try {
            PageResult<CarrierLibraryRecycleBin> result = carrierLibraryService.listRecycleBin(page, size);
            return Result.success(result);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("获取回收站列表失败: " + e.getMessage());
        }
    }

    @Operation(summary = "恢复运营商", description = "从回收站恢复运营商")
    @PostMapping("/recycle-bin/{sku}/restore")
    public Result<Void> restoreMaterial(@PathVariable String sku) {
        try {
            carrierLibraryService.restoreMaterial(sku);
            return Result.success();
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("恢复运营商失败: " + e.getMessage());
        }
    }

    @Operation(summary = "批量恢复运营商", description = "从回收站批量恢复运营商")
    @PostMapping("/recycle-bin/batch-restore")
    public Result<Map<String, Object>> batchRestoreMaterials(@RequestBody List<String> skus) {
        try {
            Map<String, Object> result = carrierLibraryService.batchRestoreMaterials(skus);
            return Result.success(result);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("批量恢复运营商失败: " + e.getMessage());
        }
    }

    @Operation(summary = "永久删除运营商", description = "从回收站永久删除运营商")
    @DeleteMapping("/recycle-bin/{sku}")
    public Result<Void> permanentDeleteMaterial(@PathVariable String sku) {
        try {
            carrierLibraryService.permanentDeleteMaterial(sku);
            return Result.success();
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("永久删除运营商失败: " + e.getMessage());
        }
    }

    @Operation(summary = "批量永久删除运营商", description = "从回收站批量永久删除运营商")
    @DeleteMapping("/recycle-bin/batch")
    public Result<Map<String, Object>> batchPermanentDeleteMaterials(@RequestBody List<String> skus) {
        try {
            Map<String, Object> result = carrierLibraryService.batchPermanentDeleteMaterials(skus);
            return Result.success(result);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("批量永久删除运营商失败: " + e.getMessage());
        }
    }

    @Operation(summary = "清空回收站", description = "清空回收站中的所有运营商")
    @DeleteMapping("/recycle-bin/clear")
    public Result<Map<String, Object>> clearRecycleBin() {
        try {
            Map<String, Object> result = carrierLibraryService.clearRecycleBin();
            return Result.success(result);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("清空回收站失败: " + e.getMessage());
        }
    }

    // ==================== 批次统计 ====================

    @Operation(summary = "获取批次数量", description = "获取指定批次的运营商数量")
    @GetMapping("/batch/{batch}/count")
    public Result<Map<String, Object>> getBatchCount(@PathVariable String batch) {
        try {
            Long count = carrierLibraryService.getBatchCount(batch);
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
