package com.sjzm.service;

import com.sjzm.common.BusinessException;
import com.sjzm.entity.FinalDraft;
import com.sjzm.mapper.FinalDraftMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.*;

/**
 * 定稿Excel导入服务
 * <p>
 * 对齐 Python final_drafts.py 的批量导入逻辑：
 * 1. 支持 .xlsx 和 .xls 格式
 * 2. 检查数据库中已存在的SKU
 * 3. 支持跳过/覆盖模式
 * 4. 返回详细的导入结果
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FinalDraftImportService {

    private final FinalDraftMapper finalDraftMapper;

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> importFromExcel(MultipartFile file, boolean overwrite) {
        log.info("开始导入定稿Excel文件: filename={}, size={}, overwrite={}",
                file.getOriginalFilename(), file.getSize(), overwrite);

        if (file.isEmpty()) {
            throw new BusinessException("上传的文件不能为空");
        }

        String filename = file.getOriginalFilename();
        if (filename == null || (!filename.toLowerCase().endsWith(".xlsx") && !filename.toLowerCase().endsWith(".xls"))) {
            throw new BusinessException("只支持 .xlsx 或 .xls 格式的Excel文件");
        }

        try (Workbook workbook = WorkbookFactory.create(file.getInputStream())) {
            Sheet sheet = workbook.getSheetAt(0);
            return processSheet(sheet, overwrite);
        } catch (IOException e) {
            log.error("读取Excel文件失败", e);
            throw new BusinessException("读取Excel文件失败: " + e.getMessage());
        } catch (Exception e) {
            log.error("处理Excel文件失败", e);
            throw new BusinessException("处理Excel文件失败: " + e.getMessage());
        }
    }

    private Map<String, Object> processSheet(Sheet sheet, boolean overwrite) {
        Row headerRow = sheet.getRow(0);
        if (headerRow == null) {
            throw new BusinessException("Excel文件格式错误：没有找到表头行");
        }

        Map<String, Integer> columnMap = parseHeader(headerRow);

        List<FinalDraftData> validDrafts = new ArrayList<>();
        Set<String> duplicateInFile = new HashSet<>();
        List<String> errors = new ArrayList<>();
        int rowCount = sheet.getPhysicalNumberOfRows() - 1;

        for (int i = 1; i <= sheet.getLastRowNum(); i++) {
            Row row = sheet.getRow(i);
            if (row == null) continue;

            try {
                FinalDraftData data = parseRow(row, columnMap, i + 1);

                if (!StringUtils.hasText(data.sku)) {
                    errors.add(String.format("第%d行: SKU不能为空", i + 1));
                    continue;
                }

                if (duplicateInFile.contains(data.sku)) {
                    errors.add(String.format("第%d行: SKU %s 在文件中重复", i + 1, data.sku));
                    continue;
                }
                duplicateInFile.add(data.sku);

                validDrafts.add(data);

            } catch (Exception e) {
                errors.add(String.format("第%d行: %s", i + 1, e.getMessage()));
            }
        }

        if (validDrafts.isEmpty()) {
            Map<String, Object> result = new HashMap<>();
            result.put("success", 0);
            result.put("failed", rowCount);
            result.put("errors", errors.size() > 10 ? errors.subList(0, 10) : errors);
            return result;
        }

        return executeImport(validDrafts, overwrite, errors);
    }

    private Map<String, Integer> parseHeader(Row headerRow) {
        Map<String, Integer> columnMap = new HashMap<>();

        for (int i = 0; i < headerRow.getLastCellNum(); i++) {
            Cell cell = headerRow.getCell(i);
            if (cell != null && cell.getCellType() == CellType.STRING) {
                String header = cell.getStringCellValue().trim();
                if (StringUtils.hasText(header)) {
                    columnMap.put(header, i);
                }
            }
        }

        String[] aliases = {
                "SKU", "sku",
                "批次", "batch", "Batch",
                "开发人", "developer", "Developer",
                "载体", "carrier", "Carrier",
                "元素", "element", "Element",
                "修改要求", "modificationRequirement", "modification_requirement",
                "侵权标签", "infringementLabel", "infringement_label",
                "图片", "images", "Images",
                "参考图", "referenceImages", "reference_images",
                "状态", "status", "Status"
        };

        for (String alias : aliases) {
            if (columnMap.containsKey(alias)) {
                String standardName = getStandardName(alias);
                if (!columnMap.containsKey(standardName)) {
                    columnMap.put(standardName, columnMap.get(alias));
                }
            }
        }

        log.info("解析表头完成: 列数={}", columnMap.size());
        return columnMap;
    }

    private String getStandardName(String alias) {
        Map<String, String> mapping = new HashMap<>();
        mapping.put("SKU", "sku");
        mapping.put("sku", "sku");
        mapping.put("批次", "batch");
        mapping.put("batch", "batch");
        mapping.put("Batch", "batch");
        mapping.put("开发人", "developer");
        mapping.put("developer", "developer");
        mapping.put("Developer", "developer");
        mapping.put("载体", "carrier");
        mapping.put("carrier", "carrier");
        mapping.put("Carrier", "carrier");
        mapping.put("元素", "element");
        mapping.put("element", "element");
        mapping.put("Element", "element");
        mapping.put("修改要求", "modificationRequirement");
        mapping.put("modificationRequirement", "modificationRequirement");
        mapping.put("modification_requirement", "modificationRequirement");
        mapping.put("侵权标签", "infringementLabel");
        mapping.put("infringementLabel", "infringementLabel");
        mapping.put("infringement_label", "infringementLabel");
        mapping.put("图片", "images");
        mapping.put("images", "images");
        mapping.put("Images", "images");
        mapping.put("参考图", "referenceImages");
        mapping.put("referenceImages", "referenceImages");
        mapping.put("reference_images", "referenceImages");
        mapping.put("状态", "status");
        mapping.put("status", "status");
        mapping.put("Status", "status");
        return mapping.getOrDefault(alias, alias);
    }

    private FinalDraftData parseRow(Row row, Map<String, Integer> columnMap, int rowNum) {
        FinalDraftData data = new FinalDraftData();

        data.sku = getCellStringValue(row, columnMap.get("sku"));
        data.batch = getCellStringValue(row, columnMap.get("batch"));
        data.developer = getCellStringValue(row, columnMap.get("developer"));
        data.carrier = getCellStringValue(row, columnMap.get("carrier"));
        data.element = getCellStringValue(row, columnMap.get("element"));
        data.modificationRequirement = getCellStringValue(row, columnMap.get("modificationRequirement"));
        data.infringementLabel = getCellStringValue(row, columnMap.get("infringementLabel"));
        data.images = getCellStringValue(row, columnMap.get("images"));
        data.referenceImages = getCellStringValue(row, columnMap.get("referenceImages"));
        data.status = getCellStringValue(row, columnMap.get("status"));

        return data;
    }

    private String getCellStringValue(Row row, Integer columnIndex) {
        if (columnIndex == null) return null;

        Cell cell = row.getCell(columnIndex);
        if (cell == null) return null;

        switch (cell.getCellType()) {
            case STRING:
                return cell.getStringCellValue().trim();
            case NUMERIC:
                return String.valueOf((long) cell.getNumericCellValue());
            case BOOLEAN:
                return String.valueOf(cell.getBooleanCellValue());
            case FORMULA:
                try {
                    return cell.getStringCellValue().trim();
                } catch (Exception e) {
                    return String.valueOf((long) cell.getNumericCellValue());
                }
            default:
                return null;
        }
    }

    @Transactional(rollbackFor = Exception.class)
    protected Map<String, Object> executeImport(List<FinalDraftData> drafts, boolean overwrite, List<String> errors) {
        log.info("执行定稿导入: 总数={}, 覆盖={}", drafts.size(), overwrite);

        int success = 0;
        int skipped = 0;

        List<String> skus = new ArrayList<>();
        for (FinalDraftData d : drafts) {
            skus.add(d.sku);
        }

        Map<String, FinalDraft> existingMap = new HashMap<>();
        List<FinalDraft> existing = finalDraftMapper.selectList(
                new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<FinalDraft>()
                        .in(FinalDraft::getSku, skus)
        );
        for (FinalDraft fd : existing) {
            existingMap.put(fd.getSku(), fd);
        }

        for (FinalDraftData data : drafts) {
            try {
                FinalDraft existingDraft = existingMap.get(data.sku);

                if (existingDraft != null) {
                    if (overwrite) {
                        updateFinalDraftFromData(existingDraft, data);
                        finalDraftMapper.updateById(existingDraft);
                        success++;
                        log.debug("更新定稿: sku={}", data.sku);
                    } else {
                        skipped++;
                        errors.add(String.format("SKU %s: 已存在，已跳过", data.sku));
                    }
                } else {
                    FinalDraft newDraft = createFinalDraftFromData(data);
                    finalDraftMapper.insert(newDraft);
                    success++;
                    log.debug("新增定稿: sku={}", data.sku);
                }
            } catch (Exception e) {
                errors.add(String.format("SKU %s: %s", data.sku, e.getMessage()));
                log.error("导入定稿失败: sku={}, error={}", data.sku, e.getMessage());
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("success", success);
        result.put("skipped", skipped);
        result.put("failed", errors.size());
        result.put("total", drafts.size());
        result.put("errors", errors.size() > 10 ? errors.subList(0, 10) : errors);

        log.info("定稿导入完成: 成功={}, 跳过={}, 失败={}", success, skipped, errors.size());
        return result;
    }

    private FinalDraft createFinalDraftFromData(FinalDraftData data) {
        FinalDraft draft = new FinalDraft();
        draft.setSku(data.sku);
        draft.setBatch(StringUtils.hasText(data.batch) ? data.batch : "");
        draft.setDeveloper(StringUtils.hasText(data.developer) ? data.developer : "");
        draft.setCarrier(StringUtils.hasText(data.carrier) ? data.carrier : "");
        draft.setElement(StringUtils.hasText(data.element) ? data.element : "");
        draft.setModificationRequirement(data.modificationRequirement);
        draft.setInfringementLabel(data.infringementLabel);
        draft.setImages(data.images);
        draft.setReferenceImages(data.referenceImages);
        draft.setStatus(StringUtils.hasText(data.status) ? data.status : "pending");
        draft.setCreateTime(LocalDateTime.now());
        draft.setUpdateTime(LocalDateTime.now());
        return draft;
    }

    private void updateFinalDraftFromData(FinalDraft draft, FinalDraftData data) {
        if (StringUtils.hasText(data.batch)) draft.setBatch(data.batch);
        if (StringUtils.hasText(data.developer)) draft.setDeveloper(data.developer);
        if (StringUtils.hasText(data.carrier)) draft.setCarrier(data.carrier);
        if (StringUtils.hasText(data.element)) draft.setElement(data.element);
        if (data.modificationRequirement != null) draft.setModificationRequirement(data.modificationRequirement);
        if (data.infringementLabel != null) draft.setInfringementLabel(data.infringementLabel);
        if (data.images != null) draft.setImages(data.images);
        if (data.referenceImages != null) draft.setReferenceImages(data.referenceImages);
        if (StringUtils.hasText(data.status)) draft.setStatus(data.status);
        draft.setUpdateTime(LocalDateTime.now());
    }

    public byte[] generateImportTemplate() {
        log.info("生成定稿导入模板");

        try (Workbook workbook = new XSSFWorkbook()) {
            Sheet sheet = workbook.createSheet("定稿导入模板");

            String[] headers = {
                    "sku", "batch", "developer", "carrier", "element",
                    "modificationRequirement", "infringementLabel", "images", "referenceImages", "status"
            };

            Row headerRow = sheet.createRow(0);
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(createHeaderStyle(workbook));
            }

            Row dataRow = sheet.createRow(1);
            dataRow.createCell(0).setCellValue("SKU001");
            dataRow.createCell(1).setCellValue("BATCH001");
            dataRow.createCell(2).setCellValue("开发者A");
            dataRow.createCell(3).setCellValue("载体A");
            dataRow.createCell(4).setCellValue("元素1,元素2");
            dataRow.createCell(5).setCellValue("修改要求描述");
            dataRow.createCell(6).setCellValue("无侵权");
            dataRow.createCell(7).setCellValue("image1.jpg,image2.jpg");
            dataRow.createCell(8).setCellValue("ref1.jpg,ref2.jpg");
            dataRow.createCell(9).setCellValue("pending");

            for (int i = 0; i < headers.length; i++) {
                sheet.setColumnWidth(i, 20 * 256);
            }

            java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
            workbook.write(baos);
            return baos.toByteArray();

        } catch (IOException e) {
            log.error("生成导入模板失败", e);
            throw new BusinessException("生成导入模板失败: " + e.getMessage());
        }
    }

    private CellStyle createHeaderStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        Font font = workbook.createFont();
        font.setBold(true);
        style.setFont(font);
        style.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        return style;
    }

    private static class FinalDraftData {
        String sku;
        String batch;
        String developer;
        String carrier;
        String element;
        String modificationRequirement;
        String infringementLabel;
        String images;
        String referenceImages;
        String status;
    }
}
