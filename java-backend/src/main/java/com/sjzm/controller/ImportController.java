package com.sjzm.controller;

import com.sjzm.common.BusinessException;
import com.sjzm.common.Result;
import com.sjzm.entity.Product;
import com.sjzm.entity.Image;
import com.sjzm.mapper.ProductMapper;
import com.sjzm.mapper.ImageMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import jakarta.servlet.http.HttpServletResponse;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.HashSet;

@Slf4j
@RestController
@RequestMapping("/api/import")
@RequiredArgsConstructor
@Tag(name = "导入功能", description = "Excel批量导入产品、图片等数据")
public class ImportController {

    private final ProductMapper productMapper;
    private final ImageMapper imageMapper;

    @PostMapping("/products")
    @Operation(summary = "导入产品", description = "导入产品数据（Excel文件）")
    public Result<Map<String, Object>> importProducts(
            @Parameter(description = "Excel文件（.xlsx或.xls）") @RequestParam("file") MultipartFile file) {
        try {
            if (file.isEmpty()) {
                throw new BusinessException("文件不能为空");
            }

            String filename = file.getOriginalFilename();
            if (filename == null || (!filename.toLowerCase().endsWith(".xlsx") && !filename.toLowerCase().endsWith(".xls"))) {
                throw new BusinessException("只支持.xlsx或.xls格式的Excel文件");
            }

            List<Map<String, Object>> products = parseProductExcel(file);
            if (products.isEmpty()) {
                throw new BusinessException("Excel文件中没有有效数据");
            }

            Set<String> existingSkus = getExistingSkus(products);
            List<Map<String, Object>> productsToInsert = new ArrayList<>();
            List<String> errors = new ArrayList<>();
            int successCount = 0;
            int duplicateCount = 0;

            for (int i = 0; i < products.size(); i++) {
                Map<String, Object> product = products.get(i);
                String sku = String.valueOf(product.get("sku"));
                String name = String.valueOf(product.get("name"));

                if (sku.isEmpty() || name.isEmpty() || "null".equals(sku) || "null".equals(name)) {
                    errors.add(String.format("第%d行: SKU或产品名称不能为空", i + 2));
                    continue;
                }

                if (existingSkus.contains(sku)) {
                    errors.add(String.format("SKU %s 已存在于数据库中", sku));
                    duplicateCount++;
                    continue;
                }

                productsToInsert.add(product);
            }

            if (!productsToInsert.isEmpty()) {
                for (Map<String, Object> product : productsToInsert) {
                    try {
                        Product entity = convertToProduct(product);
                        productMapper.insert(entity);
                        successCount++;
                    } catch (Exception e) {
                        errors.add(String.format("SKU %s: %s", product.get("sku"), e.getMessage()));
                    }
                }
            }

            Map<String, Object> result = new HashMap<>();
            result.put("success", successCount);
            result.put("failed", products.size() - successCount);
            result.put("errors", errors.subList(0, Math.min(errors.size(), 10)));

            String message = String.format("导入完成，成功%d条，失败%d条（含%d条重复）",
                    successCount, products.size() - successCount, duplicateCount);

            log.info("导入产品完成: 成功={}, 失败={}", successCount, products.size() - successCount);
            return Result.success(message, result);

        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("导入产品失败", e);
            throw new BusinessException("导入产品失败: " + e.getMessage());
        }
    }

    @PostMapping("/images")
    @Operation(summary = "导入图片", description = "导入图片数据（Excel文件）")
    public Result<Map<String, Object>> importImages(
            @Parameter(description = "Excel文件（.xlsx或.xls）") @RequestParam("file") MultipartFile file) {
        try {
            if (file.isEmpty()) {
                throw new BusinessException("文件不能为空");
            }

            String filename = file.getOriginalFilename();
            if (filename == null || (!filename.toLowerCase().endsWith(".xlsx") && !filename.toLowerCase().endsWith(".xls"))) {
                throw new BusinessException("只支持.xlsx或.xls格式的Excel文件");
            }

            List<Map<String, Object>> images = parseImageExcel(file);
            if (images.isEmpty()) {
                throw new BusinessException("Excel文件中没有有效数据");
            }

            int successCount = 0;
            List<String> errors = new ArrayList<>();

            for (int i = 0; i < images.size(); i++) {
                Map<String, Object> img = images.get(i);
                String filename_val = String.valueOf(img.get("filename"));
                String category = String.valueOf(img.get("category"));

                if (filename_val.isEmpty() || category.isEmpty() || "null".equals(filename_val) || "null".equals(category)) {
                    errors.add(String.format("第%d行: 文件名或分类不能为空", i + 2));
                    continue;
                }

                try {
                    Image entity = convertToImage(img);
                    imageMapper.insert(entity);
                    successCount++;
                } catch (Exception e) {
                    errors.add(String.format("第%d行: %s", i + 2, e.getMessage()));
                }
            }

            Map<String, Object> result = new HashMap<>();
            result.put("success", successCount);
            result.put("failed", images.size() - successCount);
            result.put("errors", errors.subList(0, Math.min(errors.size(), 10)));

            String message = String.format("导入完成，成功%d条，失败%d条", successCount, images.size() - successCount);

            log.info("导入图片完成: 成功={}, 失败={}", successCount, images.size() - successCount);
            return Result.success(message, result);

        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("导入图片失败", e);
            throw new BusinessException("导入图片失败: " + e.getMessage());
        }
    }

    @GetMapping("/template/products")
    @Operation(summary = "下载产品导入模板", description = "下载产品导入Excel模板")
    public void downloadProductTemplate(HttpServletResponse response) {
        try (Workbook workbook = new XSSFWorkbook()) {
            Sheet sheet = workbook.createSheet("产品导入模板");

            String[] headers = {"SKU", "产品名称", "创建时间", "产品类型", "包含单品", "开发者", "图片链接"};
            String[] exampleSkus = {"SKU001", "SKU002", "SKU003"};
            String[] exampleNames = {"示例产品1", "示例产品2", "示例产品3"};
            String[] exampleTimes = {"2024-01-01 10:00:00", "2024-01-02 11:00:00", "2024-01-03 12:00:00"};
            String[] exampleTypes = {"普通产品", "组合产品", "定制产品"};
            String[] exampleItems = {"", "2570009*1;2570010*1", ""};
            String[] exampleDevs = {"开发者A", "开发者B", "开发者C"};
            String[] exampleImgs = {
                "http://example.com/image1.jpg",
                "http://example.com/image2.jpg",
                "http://example.com/image3.jpg"
            };

            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            Row headerRow = sheet.createRow(0);
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
                sheet.setColumnWidth(i, 4000);
            }

            for (int rowIdx = 0; rowIdx < exampleSkus.length; rowIdx++) {
                Row row = sheet.createRow(rowIdx + 1);
                row.createCell(0).setCellValue(exampleSkus[rowIdx]);
                row.createCell(1).setCellValue(exampleNames[rowIdx]);
                row.createCell(2).setCellValue(exampleTimes[rowIdx]);
                row.createCell(3).setCellValue(exampleTypes[rowIdx]);
                row.createCell(4).setCellValue(exampleItems[rowIdx]);
                row.createCell(5).setCellValue(exampleDevs[rowIdx]);
                row.createCell(6).setCellValue(exampleImgs[rowIdx]);
            }

            sheet.setColumnWidth(1, 8000);
            sheet.setColumnWidth(4, 8000);
            sheet.setColumnWidth(6, 10000);

            response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            response.setCharacterEncoding("utf-8");
            response.setHeader("Content-Disposition",
                    "attachment;filename=" + URLEncoder.encode("product_import_template.xlsx", StandardCharsets.UTF_8));

            workbook.write(response.getOutputStream());

        } catch (IOException e) {
            log.error("生成产品导入模板失败", e);
            throw new BusinessException("生成产品导入模板失败");
        }
    }

    @GetMapping("/template/images")
    @Operation(summary = "下载图片导入模板", description = "下载图片导入Excel模板")
    public void downloadImageTemplate(HttpServletResponse response) {
        try (Workbook workbook = new XSSFWorkbook()) {
            Sheet sheet = workbook.createSheet("图片导入模板");

            String[] headers = {"文件名", "文件路径", "分类", "标签", "描述"};

            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            Row headerRow = sheet.createRow(0);
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
                sheet.setColumnWidth(i, 6000);
            }

            String[] exampleFiles = {"image001.jpg", "image002.jpg"};
            String[] examplePaths = {"/path/to/image001.jpg", "/path/to/image002.jpg"};
            String[] exampleCats = {"电子产品", "家居用品"};
            String[] exampleTags = {"标签1,标签2", "标签3"};
            String[] exampleDescs = {"图片描述1", "图片描述2"};

            for (int rowIdx = 0; rowIdx < exampleFiles.length; rowIdx++) {
                Row row = sheet.createRow(rowIdx + 1);
                row.createCell(0).setCellValue(exampleFiles[rowIdx]);
                row.createCell(1).setCellValue(examplePaths[rowIdx]);
                row.createCell(2).setCellValue(exampleCats[rowIdx]);
                row.createCell(3).setCellValue(exampleTags[rowIdx]);
                row.createCell(4).setCellValue(exampleDescs[rowIdx]);
            }

            response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            response.setCharacterEncoding("utf-8");
            response.setHeader("Content-Disposition",
                    "attachment;filename=" + URLEncoder.encode("image_import_template.xlsx", StandardCharsets.UTF_8));

            workbook.write(response.getOutputStream());

        } catch (IOException e) {
            log.error("生成图片导入模板失败", e);
            throw new BusinessException("生成图片导入模板失败");
        }
    }

    private List<Map<String, Object>> parseProductExcel(MultipartFile file) throws IOException {
        List<Map<String, Object>> products = new ArrayList<>();

        try (Workbook workbook = WorkbookFactory.create(file.getInputStream())) {
            Sheet sheet = workbook.getSheetAt(0);
            if (sheet == null || sheet.getPhysicalNumberOfRows() == 0) {
                return products;
            }

            Row headerRow = sheet.getRow(0);
            if (headerRow == null) {
                return products;
            }

            Map<Integer, String> headerMap = new HashMap<>();
            for (int cellIdx = 0; cellIdx < headerRow.getLastCellNum(); cellIdx++) {
                Cell cell = headerRow.getCell(cellIdx);
                if (cell != null) {
                    headerMap.put(cellIdx, cell.getStringCellValue().trim());
                }
            }

            for (int rowIdx = 1; rowIdx <= sheet.getLastRowNum(); rowIdx++) {
                Row row = sheet.getRow(rowIdx);
                if (row == null || isRowEmpty(row)) {
                    continue;
                }

                Map<String, Object> product = new HashMap<>();

                for (Map.Entry<Integer, String> entry : headerMap.entrySet()) {
                    int cellIdx = entry.getKey();
                    String header = entry.getValue();
                    Cell cell = row.getCell(cellIdx);

                    Object value = getCellValue(cell);
                    if (value != null) {
                        product.put(header, value.toString().trim());
                    } else {
                        product.put(header, "");
                    }
                }

                if (!product.isEmpty()) {
                    products.add(product);
                }
            }
        }

        return products;
    }

    private List<Map<String, Object>> parseImageExcel(MultipartFile file) throws IOException {
        List<Map<String, Object>> images = new ArrayList<>();

        try (Workbook workbook = WorkbookFactory.create(file.getInputStream())) {
            Sheet sheet = workbook.getSheetAt(0);
            if (sheet == null || sheet.getPhysicalNumberOfRows() == 0) {
                return images;
            }

            Row headerRow = sheet.getRow(0);
            if (headerRow == null) {
                return images;
            }

            Map<Integer, String> headerMap = new HashMap<>();
            for (int cellIdx = 0; cellIdx < headerRow.getLastCellNum(); cellIdx++) {
                Cell cell = headerRow.getCell(cellIdx);
                if (cell != null) {
                    headerMap.put(cellIdx, cell.getStringCellValue().trim());
                }
            }

            for (int rowIdx = 1; rowIdx <= sheet.getLastRowNum(); rowIdx++) {
                Row row = sheet.getRow(rowIdx);
                if (row == null || isRowEmpty(row)) {
                    continue;
                }

                Map<String, Object> image = new HashMap<>();

                for (Map.Entry<Integer, String> entry : headerMap.entrySet()) {
                    int cellIdx = entry.getKey();
                    String header = entry.getValue();
                    Cell cell = row.getCell(cellIdx);

                    Object value = getCellValue(cell);
                    if (value != null) {
                        image.put(header, value.toString().trim());
                    } else {
                        image.put(header, "");
                    }
                }

                if (!image.isEmpty()) {
                    images.add(image);
                }
            }
        }

        return images;
    }

    private boolean isRowEmpty(Row row) {
        if (row == null) return true;
        for (int i = 0; i < row.getLastCellNum(); i++) {
            Cell cell = row.getCell(i);
            if (cell != null && cell.getCellType() != CellType.BLANK) {
                String value = getCellValueAsString(cell);
                if (value != null && !value.trim().isEmpty()) {
                    return false;
                }
            }
        }
        return true;
    }

    private Object getCellValue(Cell cell) {
        if (cell == null) return null;

        switch (cell.getCellType()) {
            case STRING:
                return cell.getStringCellValue();
            case NUMERIC:
                if (DateUtil.isCellDateFormatted(cell)) {
                    return cell.getLocalDateTimeCellValue().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
                }
                return cell.getNumericCellValue();
            case BOOLEAN:
                return cell.getBooleanCellValue();
            case FORMULA:
                try {
                    return cell.getStringCellValue();
                } catch (Exception e) {
                    return cell.getNumericCellValue();
                }
            default:
                return null;
        }
    }

    private String getCellValueAsString(Cell cell) {
        Object value = getCellValue(cell);
        return value != null ? value.toString() : "";
    }

    private Set<String> getExistingSkus(List<Map<String, Object>> products) {
        Set<String> skus = new HashSet<>();
        for (Map<String, Object> product : products) {
            String sku = String.valueOf(product.get("SKU"));
            if (sku != null && !sku.isEmpty() && !"null".equals(sku)) {
                skus.add(sku);
            }
        }

        if (skus.isEmpty()) {
            return new HashSet<>();
        }

        List<Product> existing = productMapper.selectBySkus(new ArrayList<>(skus));
        Set<String> existingSkus = new HashSet<>();
        for (Product p : existing) {
            if (p.getSku() != null) {
                existingSkus.add(p.getSku());
            }
        }
        return existingSkus;
    }

    private Product convertToProduct(Map<String, Object> data) {
        Product product = new Product();
        product.setSku(getStringValue(data, "SKU"));
        product.setName(getStringValue(data, "产品名称"));

        String productType = getStringValue(data, "产品类型");
        product.setType(productType.isEmpty() ? "普通产品" : productType);

        product.setDeveloper(getStringValue(data, "开发者"));
        product.setIncludedItems(getStringValue(data, "包含单品"));
        product.setImage(getStringValue(data, "图片链接"));

        String createTime = getStringValue(data, "创建时间");
        if (!createTime.isEmpty()) {
            try {
                LocalDateTime dt = LocalDateTime.parse(createTime, DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
                product.setCreateTime(dt);
            } catch (DateTimeParseException e) {
                try {
                    LocalDateTime dt = LocalDateTime.parse(createTime.replace("/", "-"), DateTimeFormatter.ISO_LOCAL_DATE_TIME);
                    product.setCreateTime(dt);
                } catch (Exception ex) {
                    product.setCreateTime(LocalDateTime.now());
                }
            }
        } else {
            product.setCreateTime(LocalDateTime.now());
        }

        product.setUpdateTime(LocalDateTime.now());

        return product;
    }

    private Image convertToImage(Map<String, Object> data) {
        Image image = new Image();
        image.setFilename(getStringValue(data, "文件名"));
        image.setFilepath(getStringValue(data, "文件路径"));
        image.setCategory(getStringValue(data, "分类"));
        image.setTags(getStringValue(data, "标签"));
        image.setDescription(getStringValue(data, "描述"));
        image.setCreatedAt(LocalDateTime.now());
        image.setUpdatedAt(LocalDateTime.now());
        return image;
    }

    private String getStringValue(Map<String, Object> data, String key) {
        Object value = data.get(key);
        if (value == null) return "";
        String str = value.toString().trim();
        return "null".equals(str) ? "" : str;
    }
}
