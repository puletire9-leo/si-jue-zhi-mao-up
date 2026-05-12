package com.sjzm.service;

import com.sjzm.common.BusinessException;
import com.sjzm.entity.Product;
import com.sjzm.mapper.ProductMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * 产品Excel导出服务
 * <p>
 * 对齐 Python export.py 的产品导出逻辑：
 * 1. 支持 .xlsx 和 .xls 格式
 * 2. 支持指定字段导出
 * 3. 支持筛选条件
 * 4. 返回Excel文件字节数组
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ProductExportService {

    private final ProductMapper productMapper;

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private static final String[] EXPORT_COLUMNS = {
            "id", "sku", "name", "description", "category", "type", "price", "stock",
            "image", "developer", "localPath", "thumbPath", "includedItems", "tags",
            "status", "createdAt", "updatedAt"
    };

    private static final String[] COLUMN_HEADERS_CN = {
            "ID", "SKU", "产品名称", "描述", "分类", "产品类型", "价格", "库存",
            "图片链接", "开发者", "本地路径", "缩略图路径", "包含单品", "标签",
            "状态", "创建时间", "更新时间"
    };

    public byte[] exportProducts(List<Long> ids, String keyword, String category, String type) {
        log.info("导出产品: ids={}, keyword={}, category={}, type={}",
                ids != null ? ids.size() : 0, keyword, category, type);

        try (Workbook workbook = new XSSFWorkbook()) {
            Sheet sheet = workbook.createSheet("产品导出");

            createHeaderRow(sheet);

            List<Product> products;
            if (ids != null && !ids.isEmpty()) {
                products = productMapper.selectBatchIds(ids);
            } else {
                products = getFilteredProducts(keyword, category, type);
            }

            int rowNum = 1;
            for (Product product : products) {
                Row row = sheet.createRow(rowNum++);
                createProductRow(row, product);
            }

            autoSizeColumns(sheet);

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            workbook.write(baos);
            log.info("产品导出成功: 共{}条记录", products.size());
            return baos.toByteArray();

        } catch (IOException e) {
            log.error("导出产品失败", e);
            throw new BusinessException("导出产品失败: " + e.getMessage());
        }
    }

    public byte[] exportProductsBySkus(List<String> skus) {
        log.info("导出产品（按SKU）: {}条", skus != null ? skus.size() : 0);

        if (skus == null || skus.isEmpty()) {
            return exportProducts(null, null, null, null);
        }

        try (Workbook workbook = new XSSFWorkbook()) {
            Sheet sheet = workbook.createSheet("产品导出");

            createHeaderRow(sheet);

            List<Product> products = productMapper.selectList(
                    new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<Product>()
                            .in(Product::getSku, skus)
                            .eq(Product::getStatus, "normal")
            );

            int rowNum = 1;
            for (Product product : products) {
                Row row = sheet.createRow(rowNum++);
                createProductRow(row, product);
            }

            autoSizeColumns(sheet);

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            workbook.write(baos);
            log.info("产品导出成功: 共{}条记录", products.size());
            return baos.toByteArray();

        } catch (IOException e) {
            log.error("导出产品失败", e);
            throw new BusinessException("导出产品失败: " + e.getMessage());
        }
    }

    public byte[] exportProductsTemplate() {
        log.info("导出产品模板");

        try (Workbook workbook = new XSSFWorkbook()) {
            Sheet sheet = workbook.createSheet("产品模板");

            createHeaderRow(sheet);

            Row sampleRow = sheet.createRow(1);
            sampleRow.createCell(0).setCellValue(1);
            sampleRow.createCell(1).setCellValue("示例SKU");
            sampleRow.createCell(2).setCellValue("示例产品名称");
            sampleRow.createCell(3).setCellValue("示例描述");
            sampleRow.createCell(4).setCellValue("");
            sampleRow.createCell(5).setCellValue("普通产品");
            sampleRow.createCell(6).setCellValue(99.99);
            sampleRow.createCell(7).setCellValue(100);
            sampleRow.createCell(8).setCellValue("");
            sampleRow.createCell(9).setCellValue("");
            sampleRow.createCell(10).setCellValue("");
            sampleRow.createCell(11).setCellValue("");
            sampleRow.createCell(12).setCellValue("");
            sampleRow.createCell(13).setCellValue("");
            sampleRow.createCell(14).setCellValue("normal");
            sampleRow.createCell(15).setCellValue("2024-01-01 10:00:00");
            sampleRow.createCell(16).setCellValue("2024-01-01 10:00:00");

            autoSizeColumns(sheet);

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            workbook.write(baos);
            return baos.toByteArray();

        } catch (IOException e) {
            log.error("导出产品模板失败", e);
            throw new BusinessException("导出产品模板失败: " + e.getMessage());
        }
    }

    private List<Product> getFilteredProducts(String keyword, String category, String type) {
        var wrapper = new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<Product>();
        wrapper.eq(Product::getStatus, "normal");

        if (StringUtils.hasText(keyword)) {
            wrapper.and(w -> w.like(Product::getName, keyword)
                    .or()
                    .like(Product::getSku, keyword));
        }

        if (StringUtils.hasText(category)) {
            wrapper.eq(Product::getCategory, category);
        }

        if (StringUtils.hasText(type)) {
            wrapper.eq(Product::getType, type);
        }

        wrapper.orderByDesc(Product::getCreateTime);

        return productMapper.selectList(wrapper);
    }

    private void createHeaderRow(Sheet sheet) {
        Row headerRow = sheet.createRow(0);
        CellStyle headerStyle = createHeaderStyle(sheet.getWorkbook());

        for (int i = 0; i < COLUMN_HEADERS_CN.length; i++) {
            Cell cell = headerRow.createCell(i);
            cell.setCellValue(COLUMN_HEADERS_CN[i]);
            cell.setCellStyle(headerStyle);
        }
    }

    private CellStyle createHeaderStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        Font font = workbook.createFont();
        font.setBold(true);
        style.setFont(font);
        style.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        return style;
    }

    private void createProductRow(Row row, Product product) {
        row.createCell(0).setCellValue(product.getId() != null ? product.getId() : 0);
        row.createCell(1).setCellValue(product.getSku() != null ? product.getSku() : "");
        row.createCell(2).setCellValue(product.getName() != null ? product.getName() : "");
        row.createCell(3).setCellValue(product.getDescription() != null ? product.getDescription() : "");
        row.createCell(4).setCellValue(product.getCategory() != null ? product.getCategory() : "");
        row.createCell(5).setCellValue(product.getType() != null ? product.getType() : "");
        row.createCell(6).setCellValue(product.getPrice() != null ? product.getPrice().doubleValue() : 0);
        row.createCell(7).setCellValue(product.getStock() != null ? product.getStock() : 0);
        row.createCell(8).setCellValue(product.getImage() != null ? product.getImage() : "");
        row.createCell(9).setCellValue(product.getDeveloper() != null ? product.getDeveloper() : "");
        row.createCell(10).setCellValue(product.getLocalPath() != null ? product.getLocalPath() : "");
        row.createCell(11).setCellValue(product.getThumbPath() != null ? product.getThumbPath() : "");
        row.createCell(12).setCellValue(product.getIncludedItems() != null ? product.getIncludedItems() : "");
        row.createCell(13).setCellValue(product.getTags() != null ? product.getTags() : "");
        row.createCell(14).setCellValue(product.getStatus() != null ? product.getStatus() : "");
        row.createCell(15).setCellValue(product.getCreateTime() != null ? product.getCreateTime().format(DATE_FORMATTER) : "");
        row.createCell(16).setCellValue(product.getUpdateTime() != null ? product.getUpdateTime().format(DATE_FORMATTER) : "");
    }

    private void autoSizeColumns(Sheet sheet) {
        for (int i = 0; i < COLUMN_HEADERS_CN.length; i++) {
            sheet.autoSizeColumn(i);
            int width = sheet.getColumnWidth(i);
            if (width < 3000) {
                sheet.setColumnWidth(i, 3000);
            } else if (width > 15000) {
                sheet.setColumnWidth(i, 15000);
            }
        }
    }
}
