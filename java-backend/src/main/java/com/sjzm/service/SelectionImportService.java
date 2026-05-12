package com.sjzm.service;

import com.sjzm.common.BusinessException;
import com.sjzm.entity.Selection;
import com.sjzm.mapper.SelectionMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;

/**
 * 选品Excel导入服务
 * <p>
 * 对齐 Python selection_service.py 的批量导入逻辑：
 * 1. 支持 .xlsx 和 .xls 格式
 * 2. 支持多种字段映射
 * 3. 检查数据库中已存在的ASIN
 * 4. 支持覆盖导入
 * 5. 返回详细的导入结果
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SelectionImportService {

    private final SelectionMapper selectionMapper;

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final DateTimeFormatter[] DATE_PARSERS = {
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"),
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"),
            DateTimeFormatter.ofPattern("yyyy-MM-dd"),
            DateTimeFormatter.ofPattern("yyyy/MM/dd HH:mm:ss"),
            DateTimeFormatter.ofPattern("yyyy/MM/dd"),
    };

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> importFromExcel(MultipartFile file, boolean overwrite) {
        log.info("开始导入选品Excel文件: filename={}, size={}, overwrite={}",
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

        List<SelectionData> validSelections = new ArrayList<>();
        Set<String> duplicateInFile = new HashSet<>();
        List<String> errors = new ArrayList<>();
        int rowCount = sheet.getPhysicalNumberOfRows() - 1;

        for (int i = 1; i <= sheet.getLastRowNum(); i++) {
            Row row = sheet.getRow(i);
            if (row == null) continue;

            try {
                SelectionData data = parseRow(row, columnMap, i + 1);

                if (!StringUtils.hasText(data.asin)) {
                    errors.add(String.format("第%d行: ASIN不能为空", i + 1));
                    continue;
                }

                if (duplicateInFile.contains(data.asin)) {
                    errors.add(String.format("第%d行: ASIN %s 在文件中重复", i + 1, data.asin));
                    continue;
                }
                duplicateInFile.add(data.asin);

                validSelections.add(data);

            } catch (Exception e) {
                errors.add(String.format("第%d行: %s", i + 1, e.getMessage()));
            }
        }

        if (validSelections.isEmpty()) {
            Map<String, Object> result = new HashMap<>();
            result.put("success", 0);
            result.put("failed", rowCount);
            result.put("errors", errors.size() > 10 ? errors.subList(0, 10) : errors);
            return result;
        }

        return executeImport(validSelections, overwrite, errors);
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
                "ASIN", "asin", "Asin",
                "商品标题", "产品标题", "productTitle", "product_title", "Product Title",
                "价格", "price", "Price",
                "图片URL", "图片链接", "imageUrl", "image_url", "Image URL",
                "店铺名称", "storeName", "store_name", "Store Name",
                "店铺URL", "storeUrl", "store_url", "Store URL",
                "大类", "大类名称", "mainCategoryName", "main_category_name",
                "大类排名", "mainCategoryRank", "main_category_rank",
                "榜单增长", "mainCategoryBsrGrowth", "main_category_bsr_growth",
                "增长比率", "mainCategoryBsrGrowthRate", "main_category_bsr_growth_rate",
                "商品链接", "productLink", "product_link",
                "销量", "销售额", "salesVolume", "sales_volume",
                "上架日期", "listingDate", "listing_date",
                "配送方式", "deliveryMethod", "delivery_method",
                "相似商品", "similarProducts", "similar_products",
                "来源", "source", "Source",
                "国家", "country", "Country",
                "筛选模式", "dataFilterMode", "data_filter_mode",
                "产品类型", "productType", "product_type",
                "标签", "tags", "Tags",
                "备注", "notes", "Notes"
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
        mapping.put("ASIN", "asin");
        mapping.put("asin", "asin");
        mapping.put("Asin", "asin");
        mapping.put("商品标题", "productTitle");
        mapping.put("产品标题", "productTitle");
        mapping.put("productTitle", "productTitle");
        mapping.put("product_title", "productTitle");
        mapping.put("Product Title", "productTitle");
        mapping.put("价格", "price");
        mapping.put("price", "price");
        mapping.put("Price", "price");
        mapping.put("图片URL", "imageUrl");
        mapping.put("图片链接", "imageUrl");
        mapping.put("imageUrl", "imageUrl");
        mapping.put("image_url", "imageUrl");
        mapping.put("Image URL", "imageUrl");
        mapping.put("店铺名称", "storeName");
        mapping.put("storeName", "storeName");
        mapping.put("store_name", "storeName");
        mapping.put("Store Name", "storeName");
        mapping.put("店铺URL", "storeUrl");
        mapping.put("storeUrl", "storeUrl");
        mapping.put("store_url", "storeUrl");
        mapping.put("Store URL", "storeUrl");
        mapping.put("大类", "mainCategoryName");
        mapping.put("大类名称", "mainCategoryName");
        mapping.put("mainCategoryName", "mainCategoryName");
        mapping.put("main_category_name", "mainCategoryName");
        mapping.put("大类排名", "mainCategoryRank");
        mapping.put("mainCategoryRank", "mainCategoryRank");
        mapping.put("main_category_rank", "mainCategoryRank");
        mapping.put("榜单增长", "mainCategoryBsrGrowth");
        mapping.put("mainCategoryBsrGrowth", "mainCategoryBsrGrowth");
        mapping.put("main_category_bsr_growth", "mainCategoryBsrGrowth");
        mapping.put("增长比率", "mainCategoryBsrGrowthRate");
        mapping.put("mainCategoryBsrGrowthRate", "mainCategoryBsrGrowthRate");
        mapping.put("main_category_bsr_growth_rate", "mainCategoryBsrGrowthRate");
        mapping.put("商品链接", "productLink");
        mapping.put("productLink", "productLink");
        mapping.put("product_link", "productLink");
        mapping.put("销量", "salesVolume");
        mapping.put("销售额", "salesVolume");
        mapping.put("salesVolume", "salesVolume");
        mapping.put("sales_volume", "salesVolume");
        mapping.put("上架日期", "listingDate");
        mapping.put("listingDate", "listingDate");
        mapping.put("listing_date", "listingDate");
        mapping.put("配送方式", "deliveryMethod");
        mapping.put("deliveryMethod", "deliveryMethod");
        mapping.put("delivery_method", "deliveryMethod");
        mapping.put("相似商品", "similarProducts");
        mapping.put("similarProducts", "similarProducts");
        mapping.put("similar_products", "similarProducts");
        mapping.put("来源", "source");
        mapping.put("source", "source");
        mapping.put("Source", "source");
        mapping.put("国家", "country");
        mapping.put("country", "country");
        mapping.put("Country", "country");
        mapping.put("筛选模式", "dataFilterMode");
        mapping.put("dataFilterMode", "dataFilterMode");
        mapping.put("data_filter_mode", "dataFilterMode");
        mapping.put("产品类型", "productType");
        mapping.put("productType", "productType");
        mapping.put("product_type", "productType");
        mapping.put("标签", "tags");
        mapping.put("tags", "tags");
        mapping.put("Tags", "tags");
        mapping.put("备注", "notes");
        mapping.put("notes", "notes");
        mapping.put("Notes", "notes");
        return mapping.getOrDefault(alias, alias);
    }

    private SelectionData parseRow(Row row, Map<String, Integer> columnMap, int rowNum) {
        SelectionData data = new SelectionData();

        data.asin = getCellStringValue(row, columnMap.get("asin"));
        data.productTitle = getCellStringValue(row, columnMap.get("productTitle"));
        data.price = getCellBigDecimalValue(row, columnMap.get("price"));
        data.imageUrl = getCellStringValue(row, columnMap.get("imageUrl"));
        data.storeName = getCellStringValue(row, columnMap.get("storeName"));
        data.storeUrl = getCellStringValue(row, columnMap.get("storeUrl"));
        data.mainCategoryName = getCellStringValue(row, columnMap.get("mainCategoryName"));
        data.mainCategoryRank = getCellIntegerValue(row, columnMap.get("mainCategoryRank"));
        data.mainCategoryBsrGrowth = getCellIntegerValue(row, columnMap.get("mainCategoryBsrGrowth"));
        data.mainCategoryBsrGrowthRate = getCellBigDecimalValue(row, columnMap.get("mainCategoryBsrGrowthRate"));
        data.productLink = getCellStringValue(row, columnMap.get("productLink"));
        data.salesVolume = getCellStringValue(row, columnMap.get("salesVolume"));
        data.listingDate = getCellStringValue(row, columnMap.get("listingDate"));
        data.deliveryMethod = getCellStringValue(row, columnMap.get("deliveryMethod"));
        data.similarProducts = getCellStringValue(row, columnMap.get("similarProducts"));
        data.source = getCellStringValue(row, columnMap.get("source"));
        data.country = getCellStringValue(row, columnMap.get("country"));
        data.dataFilterMode = getCellStringValue(row, columnMap.get("dataFilterMode"));
        data.productType = getCellStringValue(row, columnMap.get("productType"));
        data.tags = getCellStringValue(row, columnMap.get("tags"));
        data.notes = getCellStringValue(row, columnMap.get("notes"));

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
                if (DateUtil.isCellDateFormatted(cell)) {
                    return cell.getLocalDateTimeCellValue().format(DATE_FORMATTER);
                }
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

    private Integer getCellIntegerValue(Row row, Integer columnIndex) {
        if (columnIndex == null) return null;

        Cell cell = row.getCell(columnIndex);
        if (cell == null) return null;

        switch (cell.getCellType()) {
            case NUMERIC:
                return (int) cell.getNumericCellValue();
            case STRING:
                try {
                    return Integer.parseInt(cell.getStringCellValue().trim().replace(",", ""));
                } catch (NumberFormatException e) {
                    return null;
                }
            default:
                return null;
        }
    }

    private BigDecimal getCellBigDecimalValue(Row row, Integer columnIndex) {
        if (columnIndex == null) return null;

        Cell cell = row.getCell(columnIndex);
        if (cell == null) return null;

        switch (cell.getCellType()) {
            case NUMERIC:
                return BigDecimal.valueOf(cell.getNumericCellValue());
            case STRING:
                try {
                    String value = cell.getStringCellValue().trim().replace(",", "");
                    if (StringUtils.hasText(value)) {
                        return new BigDecimal(value);
                    }
                    return null;
                } catch (NumberFormatException e) {
                    return null;
                }
            default:
                return null;
        }
    }

    @Transactional(rollbackFor = Exception.class)
    protected Map<String, Object> executeImport(List<SelectionData> selections, boolean overwrite, List<String> errors) {
        log.info("执行选品导入: 总数={}, 覆盖={}", selections.size(), overwrite);

        int success = 0;
        int skipped = 0;

        List<String> asins = new ArrayList<>();
        for (SelectionData s : selections) {
            asins.add(s.asin);
        }

        Map<String, Selection> existingMap = new HashMap<>();
        List<Selection> existing = selectionMapper.selectList(
                new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<Selection>()
                        .in(Selection::getAsin, asins)
        );
        for (Selection s : existing) {
            existingMap.put(s.getAsin(), s);
        }

        for (SelectionData data : selections) {
            try {
                Selection existingSelection = existingMap.get(data.asin);

                if (existingSelection != null) {
                    if (overwrite) {
                        updateSelectionFromData(existingSelection, data);
                        selectionMapper.updateById(existingSelection);
                        success++;
                        log.debug("更新选品: asin={}", data.asin);
                    } else {
                        skipped++;
                        errors.add(String.format("ASIN %s: 已存在，已跳过", data.asin));
                    }
                } else {
                    Selection newSelection = createSelectionFromData(data);
                    selectionMapper.insert(newSelection);
                    success++;
                    log.debug("新增选品: asin={}", data.asin);
                }
            } catch (Exception e) {
                errors.add(String.format("ASIN %s: %s", data.asin, e.getMessage()));
                log.error("导入选品失败: asin={}, error={}", data.asin, e.getMessage());
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("success", success);
        result.put("skipped", skipped);
        result.put("failed", errors.size());
        result.put("total", selections.size());
        result.put("errors", errors.size() > 10 ? errors.subList(0, 10) : errors);

        log.info("选品导入完成: 成功={}, 跳过={}, 失败={}", success, skipped, errors.size());
        return result;
    }

    private Selection createSelectionFromData(SelectionData data) {
        Selection selection = new Selection();
        selection.setAsin(data.asin);
        selection.setProductTitle(data.productTitle);
        selection.setPrice(data.price);
        selection.setImageUrl(data.imageUrl);
        selection.setStoreName(data.storeName);
        selection.setStoreUrl(data.storeUrl);
        selection.setMainCategoryName(data.mainCategoryName);
        selection.setMainCategoryRank(data.mainCategoryRank);
        selection.setMainCategoryBsrGrowth(data.mainCategoryBsrGrowth != null ? BigDecimal.valueOf(data.mainCategoryBsrGrowth) : null);
        selection.setMainCategoryBsrGrowthRate(data.mainCategoryBsrGrowthRate);
        selection.setProductLink(data.productLink);
        if (data.salesVolume != null && !data.salesVolume.isEmpty()) {
            try {
                selection.setSalesVolume(Integer.parseInt(data.salesVolume));
            } catch (NumberFormatException e) {
                selection.setSalesVolume(0);
            }
        }
        if (data.listingDate != null && !data.listingDate.isEmpty()) {
            try {
                selection.setListingDate(LocalDateTime.parse(data.listingDate + "T00:00:00"));
            } catch (Exception e) {
                selection.setListingDate(null);
            }
        }
        selection.setDeliveryMethod(data.deliveryMethod);
        selection.setSimilarProducts(data.similarProducts);
        selection.setSource(data.source);
        selection.setCountry(StringUtils.hasText(data.country) ? data.country : "US");
        selection.setDataFilterMode(data.dataFilterMode);
        selection.setProductType(StringUtils.hasText(data.productType) ? data.productType : "new");
        selection.setTags(data.tags);
        selection.setNotes(data.notes);
        selection.setIsCurrent(1);
        selection.setCreatedAt(LocalDateTime.now());
        selection.setUpdatedAt(LocalDateTime.now());
        return selection;
    }

    private void updateSelectionFromData(Selection selection, SelectionData data) {
        if (StringUtils.hasText(data.productTitle)) selection.setProductTitle(data.productTitle);
        if (data.price != null) selection.setPrice(data.price);
        if (data.imageUrl != null) selection.setImageUrl(data.imageUrl);
        if (data.storeName != null) selection.setStoreName(data.storeName);
        if (data.storeUrl != null) selection.setStoreUrl(data.storeUrl);
        if (data.mainCategoryName != null) selection.setMainCategoryName(data.mainCategoryName);
        if (data.mainCategoryRank != null) selection.setMainCategoryRank(data.mainCategoryRank);
        if (data.mainCategoryBsrGrowth != null) selection.setMainCategoryBsrGrowth(BigDecimal.valueOf(data.mainCategoryBsrGrowth));
        if (data.mainCategoryBsrGrowthRate != null) selection.setMainCategoryBsrGrowthRate(data.mainCategoryBsrGrowthRate);
        if (data.productLink != null) selection.setProductLink(data.productLink);
        if (data.salesVolume != null && !data.salesVolume.isEmpty()) {
            try {
                selection.setSalesVolume(Integer.parseInt(data.salesVolume));
            } catch (NumberFormatException e) {
                // ignore
            }
        }
        if (data.listingDate != null && !data.listingDate.isEmpty()) {
            try {
                selection.setListingDate(LocalDateTime.parse(data.listingDate + "T00:00:00"));
            } catch (Exception e) {
                // ignore
            }
        }
        if (data.deliveryMethod != null) selection.setDeliveryMethod(data.deliveryMethod);
        if (data.similarProducts != null) selection.setSimilarProducts(data.similarProducts);
        if (data.source != null) selection.setSource(data.source);
        if (data.country != null) selection.setCountry(data.country);
        if (data.dataFilterMode != null) selection.setDataFilterMode(data.dataFilterMode);
        if (data.productType != null) selection.setProductType(data.productType);
        if (data.tags != null) selection.setTags(data.tags);
        if (data.notes != null) selection.setNotes(data.notes);
        selection.setUpdatedAt(LocalDateTime.now());
    }

    public byte[] generateImportTemplate() {
        log.info("生成选品导入模板");

        try (Workbook workbook = new XSSFWorkbook()) {
            Sheet sheet = workbook.createSheet("选品导入模板");

            String[] headers = {
                    "asin", "productTitle", "price", "imageUrl", "storeName", "storeUrl",
                    "mainCategoryName", "mainCategoryRank", "productLink", "salesVolume",
                    "listingDate", "deliveryMethod", "source", "country", "productType", "tags", "notes"
            };

            Row headerRow = sheet.createRow(0);
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(createHeaderStyle(workbook));
            }

            Row dataRow = sheet.createRow(1);
            dataRow.createCell(0).setCellValue("B08DFXXX");
            dataRow.createCell(1).setCellValue("示例产品标题");
            dataRow.createCell(2).setCellValue(29.99);
            dataRow.createCell(3).setCellValue("https://example.com/image.jpg");
            dataRow.createCell(4).setCellValue("示例店铺");
            dataRow.createCell(5).setCellValue("https://example.com/store");
            dataRow.createCell(6).setCellValue("Kitchen & Dining");
            dataRow.createCell(7).setCellValue(1234);
            dataRow.createCell(8).setCellValue("https://amazon.com/dp/B08DFXXX");
            dataRow.createCell(9).setCellValue("1000");
            dataRow.createCell(10).setCellValue("2024-01-01");
            dataRow.createCell(11).setCellValue("FBM");
            dataRow.createCell(12).setCellValue("Helium10");
            dataRow.createCell(13).setCellValue("US");
            dataRow.createCell(14).setCellValue("new");
            dataRow.createCell(15).setCellValue("tag1,tag2");
            dataRow.createCell(16).setCellValue("这是备注");

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

    private static class SelectionData {
        String asin;
        String productTitle;
        BigDecimal price;
        String imageUrl;
        String storeName;
        String storeUrl;
        String mainCategoryName;
        Integer mainCategoryRank;
        Integer mainCategoryBsrGrowth;
        BigDecimal mainCategoryBsrGrowthRate;
        String productLink;
        String salesVolume;
        String listingDate;
        String deliveryMethod;
        String similarProducts;
        String source;
        String country;
        String dataFilterMode;
        String productType;
        String tags;
        String notes;
    }
}
