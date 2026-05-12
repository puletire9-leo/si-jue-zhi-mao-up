package com.sjzm.controller;

import com.sjzm.common.BusinessException;
import com.sjzm.common.PageResult;
import com.sjzm.common.Result;
import com.sjzm.entity.FinalDraft;
import com.sjzm.entity.FinalDraftRecycleBin;
import com.sjzm.service.FinalDraftImportService;
import com.sjzm.service.FinalDraftService;
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
 * 定稿管理控制器
 */
@Slf4j
@Tag(name = "定稿管理", description = "定稿 CRUD、批量操作、导入导出、回收站")
@RestController
@RequestMapping("/api/v1/final-drafts")
@RequiredArgsConstructor
public class FinalDraftController {

    private final FinalDraftService finalDraftService;
    private final FinalDraftImportService finalDraftImportService;

    // ==================== 基础 CRUD ====================

    @Operation(summary = "获取定稿列表", description = "分页查询定稿，支持多条件筛选")
    @GetMapping
    public Result<PageResult<FinalDraft>> listFinalDrafts(
            @Parameter(description = "页码") @RequestParam(defaultValue = "1") int page,
            @Parameter(description = "每页数量") @RequestParam(defaultValue = "20") int size,
            @Parameter(description = "搜索类型") @RequestParam(required = false) String searchType,
            @Parameter(description = "搜索内容") @RequestParam(required = false) String searchContent,
            @Parameter(description = "开发人筛选") @RequestParam(required = false) List<String> developer,
            @Parameter(description = "状态筛选") @RequestParam(required = false) List<String> status,
            @Parameter(description = "载体筛选") @RequestParam(required = false) List<String> carrier) {
        try {
            PageResult<FinalDraft> result = finalDraftService.listFinalDrafts(
                    page, size, searchType, searchContent, developer, status, carrier);
            return Result.success(result);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("获取定稿列表失败: " + e.getMessage());
        }
    }

    @Operation(summary = "获取定稿详情", description = "根据SKU获取定稿详细信息")
    @GetMapping("/sku/{sku}")
    public Result<FinalDraft> getFinalDraft(@PathVariable String sku) {
        try {
            FinalDraft finalDraft = finalDraftService.getFinalDraftBySku(sku);
            return Result.success(finalDraft);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("获取定稿详情失败: " + e.getMessage());
        }
    }

    @Operation(summary = "创建定稿", description = "创建新定稿")
    @PostMapping
    public Result<FinalDraft> createFinalDraft(@RequestBody FinalDraft finalDraft) {
        try {
            FinalDraft created = finalDraftService.createFinalDraft(finalDraft);
            return Result.success(created);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("创建定稿失败: " + e.getMessage());
        }
    }

    @Operation(summary = "更新定稿", description = "根据SKU更新定稿信息")
    @PutMapping("/sku/{sku}")
    public Result<FinalDraft> updateFinalDraft(@PathVariable String sku, @RequestBody FinalDraft finalDraft) {
        try {
            FinalDraft existing = finalDraftService.getFinalDraftBySku(sku);
            if (existing == null) {
                return Result.notFound("未找到SKU为 " + sku + " 的定稿");
            }
            FinalDraft updated = finalDraftService.updateFinalDraft(existing.getId(), finalDraft);
            return Result.success(updated);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("更新定稿失败: " + e.getMessage());
        }
    }

    @Operation(summary = "删除定稿", description = "根据SKU删除定稿（移动到回收站）")
    @DeleteMapping("/sku/{sku}")
    public Result<Void> deleteFinalDraft(@PathVariable String sku) {
        try {
            FinalDraft existing = finalDraftService.getFinalDraftBySku(sku);
            if (existing == null) {
                return Result.notFound("未找到SKU为 " + sku + " 的定稿");
            }
            finalDraftService.deleteFinalDraft(existing.getId());
            return Result.success();
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("删除定稿失败: " + e.getMessage());
        }
    }

    // ==================== 批量操作 ====================

    @Operation(summary = "批量删除定稿", description = "根据ID列表批量删除定稿（移动到回收站）")
    @DeleteMapping("/batch")
    public Result<Map<String, Object>> batchDeleteFinalDrafts(@RequestBody List<Long> ids) {
        try {
            Map<String, Object> result = finalDraftService.batchDeleteFinalDrafts(ids);
            return Result.success(result);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("批量删除定稿失败: " + e.getMessage());
        }
    }

    @Operation(summary = "批量创建定稿", description = "批量创建定稿")
    @PostMapping("/batch-create")
    public Result<Map<String, Object>> batchCreateFinalDrafts(@RequestBody List<FinalDraft> finalDrafts) {
        try {
            int successCount = 0;
            int failCount = 0;
            List<String> errors = new ArrayList<>();
            for (int i = 0; i < finalDrafts.size(); i++) {
                try {
                    finalDraftService.createFinalDraft(finalDrafts.get(i));
                    successCount++;
                } catch (Exception e) {
                    failCount++;
                    errors.add("第" + (i + 1) + "条: " + e.getMessage());
                }
            }
            Map<String, Object> result = new HashMap<>();
            result.put("total", finalDrafts.size());
            result.put("successCount", successCount);
            result.put("failCount", failCount);
            if (!errors.isEmpty()) {
                result.put("errors", errors);
            }
            return Result.success(result);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("批量创建定稿失败: " + e.getMessage());
        }
    }

    @Operation(summary = "批量更新定稿", description = "批量更新定稿信息")
    @PostMapping("/batch-update")
    public Result<Map<String, Object>> batchUpdateFinalDrafts(@RequestBody List<FinalDraft> finalDrafts) {
        try {
            int successCount = 0;
            int failCount = 0;
            List<String> errors = new ArrayList<>();
            for (int i = 0; i < finalDrafts.size(); i++) {
                try {
                    FinalDraft fd = finalDrafts.get(i);
                    FinalDraft existing = finalDraftService.getFinalDraftBySku(fd.getSku());
                    if (existing == null) {
                        failCount++;
                        errors.add("第" + (i + 1) + "条: 未找到SKU为 " + fd.getSku() + " 的定稿");
                        continue;
                    }
                    finalDraftService.updateFinalDraft(existing.getId(), fd);
                    successCount++;
                } catch (Exception e) {
                    failCount++;
                    errors.add("第" + (i + 1) + "条: " + e.getMessage());
                }
            }
            Map<String, Object> result = new HashMap<>();
            result.put("total", finalDrafts.size());
            result.put("successCount", successCount);
            result.put("failCount", failCount);
            if (!errors.isEmpty()) {
                result.put("errors", errors);
            }
            return Result.success(result);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("批量更新定稿失败: " + e.getMessage());
        }
    }

    @Operation(summary = "批量导入定稿", description = "批量导入定稿数据")
    @PostMapping("/import")
    public Result<Map<String, Object>> batchImportFinalDrafts(@RequestBody Map<String, Object> importRequest) {
        try {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> dataList = (List<Map<String, Object>>) importRequest.get("data");
            if (dataList == null || dataList.isEmpty()) {
                return Result.error("导入数据不能为空");
            }
            List<FinalDraft> finalDrafts = new ArrayList<>();
            for (Map<String, Object> item : dataList) {
                FinalDraft fd = new FinalDraft();
                if (item.get("sku") != null) fd.setSku(item.get("sku").toString());
                if (item.get("batch") != null) fd.setBatch(item.get("batch").toString());
                if (item.get("developer") != null) fd.setDeveloper(item.get("developer").toString());
                if (item.get("carrier") != null) fd.setCarrier(item.get("carrier").toString());
                if (item.get("element") != null) fd.setElement(item.get("element").toString());
                if (item.get("modificationRequirement") != null) fd.setModificationRequirement(item.get("modificationRequirement").toString());
                if (item.get("infringementLabel") != null) fd.setInfringementLabel(item.get("infringementLabel").toString());
                if (item.get("images") != null) fd.setImages(item.get("images").toString());
                if (item.get("referenceImages") != null) fd.setReferenceImages(item.get("referenceImages").toString());
                if (item.get("status") != null) fd.setStatus(item.get("status").toString());
                finalDrafts.add(fd);
            }
            Map<String, Object> result = finalDraftService.batchImportFinalDrafts(finalDrafts);
            return Result.success(result);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("批量导入定稿失败: " + e.getMessage());
        }
    }

    @Operation(summary = "Excel导入定稿", description = "上传Excel文件批量导入定稿")
    @PostMapping("/import/excel")
    public Result<Map<String, Object>> importFromExcel(
            @Parameter(description = "Excel文件(.xlsx/.xls)") @RequestParam("file") MultipartFile file,
            @Parameter(description = "是否覆盖已存在的SKU") @RequestParam(defaultValue = "false") boolean overwrite) {
        try {
            log.info("Excel导入定稿: filename={}, size={}, overwrite={}",
                    file.getOriginalFilename(), file.getSize(), overwrite);
            Map<String, Object> result = finalDraftImportService.importFromExcel(file, overwrite);
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("Excel导入定稿失败: " + e.getMessage());
        }
    }

    @Operation(summary = "下载定稿导入模板", description = "下载Excel导入模板文件")
    @GetMapping("/import/template")
    public ResponseEntity<byte[]> downloadImportTemplate() {
        try {
            byte[] template = finalDraftImportService.generateImportTemplate();
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType(
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
            headers.setContentDispositionFormData("attachment", "final_draft_import_template.xlsx");
            return ResponseEntity.ok().headers(headers).body(template);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("下载导入模板失败: " + e.getMessage());
        }
    }

    // ==================== 回收站 ====================

    @Operation(summary = "回收站列表", description = "获取回收站中的定稿列表")
    @GetMapping("/recycle-bin")
    public Result<PageResult<FinalDraftRecycleBin>> listRecycleBin(
            @Parameter(description = "页码") @RequestParam(defaultValue = "1") int page,
            @Parameter(description = "每页数量") @RequestParam(defaultValue = "20") int size) {
        try {
            PageResult<FinalDraftRecycleBin> result = finalDraftService.listRecycleBin(page, size);
            return Result.success(result);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("获取回收站列表失败: " + e.getMessage());
        }
    }

    @Operation(summary = "恢复定稿", description = "从回收站恢复定稿")
    @PostMapping("/recycle-bin/{sku}/restore")
    public Result<Void> restoreMaterial(@PathVariable String sku) {
        try {
            finalDraftService.restoreMaterial(sku);
            return Result.success();
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("恢复定稿失败: " + e.getMessage());
        }
    }

    @Operation(summary = "批量恢复定稿", description = "从回收站批量恢复定稿")
    @PostMapping("/recycle-bin/batch-restore")
    public Result<Map<String, Object>> batchRestoreMaterials(@RequestBody List<String> skus) {
        try {
            Map<String, Object> result = finalDraftService.batchRestoreMaterials(skus);
            return Result.success(result);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("批量恢复定稿失败: " + e.getMessage());
        }
    }

    @Operation(summary = "永久删除定稿", description = "从回收站永久删除定稿")
    @DeleteMapping("/recycle-bin/{sku}")
    public Result<Void> permanentDeleteMaterial(@PathVariable String sku) {
        try {
            finalDraftService.permanentDeleteMaterial(sku);
            return Result.success();
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("永久删除定稿失败: " + e.getMessage());
        }
    }

    @Operation(summary = "批量永久删除定稿", description = "从回收站批量永久删除定稿")
    @DeleteMapping("/recycle-bin/batch")
    public Result<Map<String, Object>> batchPermanentDeleteMaterials(@RequestBody List<String> skus) {
        try {
            Map<String, Object> result = finalDraftService.batchPermanentDeleteMaterials(skus);
            return Result.success(result);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("批量永久删除定稿失败: " + e.getMessage());
        }
    }

    @Operation(summary = "清空回收站", description = "清空回收站中的所有定稿")
    @DeleteMapping("/recycle-bin/clear")
    public Result<Map<String, Object>> clearRecycleBin() {
        try {
            Map<String, Object> result = finalDraftService.clearRecycleBin();
            return Result.success(result);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("清空回收站失败: " + e.getMessage());
        }
    }

    // ==================== 下载 ====================

    @Operation(summary = "下载ZIP", description = "下载定稿ZIP压缩包")
    @PostMapping("/download-zip")
    public Result<Map<String, Object>> downloadZip(@RequestBody(required = false) List<Long> ids) {
        try {
            Map<String, Object> result = new HashMap<>();
            result.put("message", "ZIP下载功能尚未实现");
            return Result.success(result);
        } catch (Exception e) {
            return Result.error("下载ZIP失败: " + e.getMessage());
        }
    }
}
