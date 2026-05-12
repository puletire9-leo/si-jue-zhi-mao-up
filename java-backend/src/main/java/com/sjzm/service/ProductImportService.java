package com.sjzm.service;

import com.sjzm.common.BusinessException;
import com.sjzm.entity.Product;
import com.sjzm.mapper.ProductMapper;
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
 * 产品Excel导入服务
 * <p>
 * 对齐 Python import_.py 的产品导入逻辑：
 * 1. 支持 .xlsx 和 .xls 格式
 * 2. 验证必需列（SKU、产品名称）
 * 3. 检查文件中重复SKU
 * 4. 检查数据库中已存在的SKU
 * 5. 支持覆盖导入
 * 6. 返回详细的导入结果
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ProductImportService {

    private final ProductMapper productMapper;

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final DateTimeFormatter[] DATE_PARSERS = {
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"),
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"),
            DateTimeFormatter.ofPattern("yyyy-MM-dd"),
            DateTimeFormatter.ofPattern("yyyy/MM/dd HH:mm:ss"),
            DateTimeFormatter.ofPattern("yyyy/MM/dd"),
    };

    public Map<String, Object> importFromExcel(MultipartFile file, boolean overwrite) {
        log.info("开始导入产品Excel文件: filename={}, size={}, overwrite={}",
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

        if (!columnMap.containsKey("SKU") || !columnMap.containsKey("产品名称")) {
            throw new BusinessException("Excel文件缺少必需列：SKU、产品名称");
        }

        List<ImportProductData> validProducts = new ArrayList<>();
        Set<String> duplicateInFile = new HashSet<>();
        List<String> errors = new ArrayList<>();
        int rowCount = sheet.getPhysicalNumberOfRows() - 1;

        for (int i = 1; i <= sheet.getLastRowNum(); i++) {
            Row row = sheet.getRow(i);
            if (row == null) continue;

            try {
                ImportProductData productData = parseRow(row, columnMap, i + 1);

                if (!StringUtils.hasText(productData.sku) || !StringUtils.hasText(productData.name)) {
                    errors.add(String.format("第%d行: SKU或产品名称不能为空", i + 1));
                    continue;
                }

                if (duplicateInFile.contains(productData.sku)) {
                    errors.add(String.format("第%d行: SKU %s 在文件中重复", i + 1, productData.sku));
                    continue;
                }
                duplicateInFile.add(productData.sku);

                validProducts.add(productData);

            } catch (Exception e) {
                errors.add(String.format("第%d行: %s", i + 1, e.getMessage()));
            }
        }

        if (validProducts.isEmpty()) {
            Map<String, Object> result = new HashMap<>();
            result.put("success", 0);
            result.put("failed", rowCount);
            result.put("errors", errors.size() > 10 ? errors.subList(0, 10) : errors);
            return result;
        }

        return executeImport(validProducts, overwrite, errors);
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

        log.info("解析表头完成: 列数={}", columnMap.size());
        return columnMap;
    }

    private ImportProductData parseRow(Row row, Map<String, Integer> columnMap, int rowNum) {
        ImportProductData data = new ImportProductData();

        data.sku = getCellStringValue(row, columnMap.get("SKU"));
        data.name = getCellStringValue(row, columnMap.get("产品名称"));
        data.type = getCellStringValueOrDefault(row, columnMap.get("产品类型"), "普通产品");
        data.developer = getCellStringValue(row, columnMap.get("开发者"));
        data.includedItems = getCellStringValue(row, columnMap.get("包含单品"));
        data.image = getCellStringValue(row, columnMap.get("图片链接"));
        data.category = getCellStringValue(row, columnMap.get("分类"));
        data.description = getCellStringValue(row, columnMap.get("描述"));
        data.stock = getCellIntegerValue(row, columnMap.get("库存"));
        data.price = getCellBigDecimalValue(row, columnMap.get("价格"));
        data.createTime = getCellDateTimeValue(row, columnMap.get("创建时间"));

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

    private String getCellStringValueOrDefault(Row row, Integer columnIndex, String defaultValue) {
        String value = getCellStringValue(row, columnIndex);
        return StringUtils.hasText(value) ? value : defaultValue;
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
                    return Integer.parseInt(cell.getStringCellValue().trim());
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
                    String value = cell.getStringCellValue().trim();
                    if (StringUtils.hasText(value)) {
                        return new BigDecimal(value.replace(",", ""));
                    }
                    return null;
                } catch (NumberFormatException e) {
                    return null;
                }
            default:
                return null;
        }
    }

    private LocalDateTime getCellDateTimeValue(Row row, Integer columnIndex) {
        if (columnIndex == null) return null;

        Cell cell = row.getCell(columnIndex);
        if (cell == null) return null;

        if (cell.getCellType() == CellType.NUMERIC && DateUtil.isCellDateFormatted(cell)) {
            return cell.getLocalDateTimeCellValue();
        }

        String dateStr = getCellStringValue(row, columnIndex);
        if (!StringUtils.hasText(dateStr)) return null;

        for (DateTimeFormatter parser : DATE_PARSERS) {
            try {
                return LocalDateTime.parse(dateStr, parser);
            } catch (DateTimeParseException e) {
                // 尝试下一个格式
            }
        }

        log.warn("无法解析日期格式: {}", dateStr);
        return null;
    }

    @Transactional(rollbackFor = Exception.class)
    protected Map<String, Object> executeImport(List<ImportProductData> products, boolean overwrite, List<String> errors) {
        log.info("执行产品导入: 总数={}, 覆盖={}", products.size(), overwrite);

        int success = 0;
        int skipped = 0;

        List<String> skus = new ArrayList<>();
        for (ImportProductData p : products) {
            skus.add(p.sku);
        }

        Map<String, Product> existingProducts = new HashMap<>();
        if (!overwrite) {
            List<Product> existing = productMapper.selectBatchIds(
                    productMapper.selectList(null).stream()
                            .filter(p -> skus.contains(p.getSku()))
                            .map(Product::getId)
                            .toList()
            );

            for (Product p : productMapper.selectList(
                    new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<Product>()
                            .in(Product::getSku, skus)
                            .eq(Product::getStatus, "normal")
            )) {
                existingProducts.put(p.getSku(), p);
            }
        }

        for (ImportProductData data : products) {
            try {
                Product existing = existingProducts.get(data.sku);

                if (existing != null) {
                    if (overwrite) {
                        updateProductFromData(existing, data);
                        productMapper.updateById(existing);
                        success++;
                        log.debug("更新产品: sku={}", data.sku);
                    } else {
                        skipped++;
                        errors.add(String.format("SKU %s: 已存在于数据库中，已跳过", data.sku));
                    }
                } else {
                    Product newProduct = createProductFromData(data);
                    productMapper.insert(newProduct);
                    success++;
                    log.debug("新增产品: sku={}", data.sku);
                }
            } catch (Exception e) {
                errors.add(String.format("SKU %s: %s", data.sku, e.getMessage()));
                log.error("导入产品失败: sku={}, error={}", data.sku, e.getMessage());
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("success", success);
        result.put("skipped", skipped);
        result.put("failed", errors.size());
        result.put("total", products.size());
        result.put("errors", errors.size() > 10 ? errors.subList(0, 10) : errors);

        log.info("产品导入完成: 成功={}, 跳过={}, 失败={}", success, skipped, errors.size());
        return result;
    }

    private Product createProductFromData(ImportProductData data) {
        Product product = new Product();
        product.setSku(data.sku);
        product.setName(data.name);
        product.setType(StringUtils.hasText(data.type) ? data.type : "普通产品");
        product.setDeveloper(data.developer);
        product.setIncludedItems(data.includedItems);
        product.setImage(data.image);
        product.setCategory(data.category);
        product.setDescription(data.description);
        product.setStock(data.stock);
        product.setPrice(data.price);
        product.setStatus("normal");
        product.setCreateTime(data.createTime != null ? data.createTime : LocalDateTime.now());
        product.setUpdateTime(LocalDateTime.now());
        return product;
    }

    private void updateProductFromData(Product product, ImportProductData data) {
        if (StringUtils.hasText(data.name)) product.setName(data.name);
        if (StringUtils.hasText(data.type)) product.setType(data.type);
        if (data.developer != null) product.setDeveloper(data.developer);
        if (data.includedItems != null) product.setIncludedItems(data.includedItems);
        if (data.image != null) product.setImage(data.image);
        if (data.category != null) product.setCategory(data.category);
        if (data.description != null) product.setDescription(data.description);
        if (data.stock != null) product.setStock(data.stock);
        if (data.price != null) product.setPrice(data.price);
        product.setUpdateTime(LocalDateTime.now());
        product.setDeleteTime(null);
    }

    public byte[] generateImportTemplate() {
        log.info("生成产品导入模板");

        try (Workbook workbook = new XSSFWorkbook()) {
            Sheet sheet = workbook.createSheet("产品导入模板");

            String[] headers = {"SKU", "产品名称", "创建时间", "产品类型", "包含单品", "开发者", "图片链接", "分类", "描述", "库存", "价格"};
            Row headerRow = sheet.createRow(0);
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(createHeaderStyle(workbook));
            }

            Row dataRow1 = sheet.createRow(1);
            dataRow1.createCell(0).setCellValue("SKU001");
            dataRow1.createCell(1).setCellValue("示例产品1");
            dataRow1.createCell(2).setCellValue("2024-01-01 10:00:00");
            dataRow1.createCell(3).setCellValue("普通产品");
            dataRow1.createCell(4).setCellValue("");
            dataRow1.createCell(5).setCellValue("开发者A");
            dataRow1.createCell(6).setCellValue("http://example.com/image1.jpg");
            dataRow1.createCell(7).setCellValue("");
            dataRow1.createCell(8).setCellValue("这是示例产品描述");
            dataRow1.createCell(9).setCellValue(100);
            dataRow1.createCell(10).setCellValue(99.99);

            Row dataRow2 = sheet.createRow(2);
            dataRow2.createCell(0).setCellValue("SKU002");
            dataRow2.createCell(1).setCellValue("示例产品2（组合产品）");
            dataRow2.createCell(2).setCellValue("2024-01-02 11:00:00");
            dataRow2.createCell(3).setCellValue("组合产品");
            dataRow2.createCell(4).setCellValue("2570009*1;2570010*1");
            dataRow2.createCell(5).setCellValue("开发者B");
            dataRow2.createCell(6).setCellValue("http://example.com/image2.jpg");
            dataRow2.createCell(7).setCellValue("");
            dataRow2.createCell(8).setCellValue("这是组合产品示例");
            dataRow2.createCell(9).setCellValue(50);
            dataRow2.createCell(10).setCellValue(199.99);

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

    private static class ImportProductData {
        String sku;
        String name;
        String type;
        String developer;
        String includedItems;
        String image;
        String category;
        String description;
        Integer stock;
        BigDecimal price;
        LocalDateTime createTime;
    }
}
