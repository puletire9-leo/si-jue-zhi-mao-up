package com.sjzm.service.impl;

import com.sjzm.entity.Image;
import com.sjzm.entity.Product;
import com.sjzm.entity.User;
import com.sjzm.mapper.ImageMapper;
import com.sjzm.mapper.ProductMapper;
import com.sjzm.mapper.UserMapper;
import com.sjzm.service.ExportService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 导出服务实现（对齐 Python 的 export）
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ExportServiceImpl implements ExportService {

    private final ProductMapper productMapper;
    private final ImageMapper imageMapper;
    private final UserMapper userMapper;

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    @Override
    public Map<String, Object> exportProducts(int page, int size, String format) {
        log.info("导出产品: page={}, size={}, format={}", page, size, format);

        if (page < 1) page = 1;
        if (size < 1) size = 100;
        if (size > 1000) size = 1000;

        int offset = (page - 1) * size;

        List<Product> products = productMapper.selectAllForExport(size, offset);

        String[] headers = {"SKU", "名称", "类型", "描述", "分类", "标签", "价格", "库存", "图片", "创建时间", "更新时间"};
        String[][] data = new String[products.size()][headers.length];

        for (int i = 0; i < products.size(); i++) {
            Product p = products.get(i);
            data[i][0] = p.getSku();
            data[i][1] = p.getName();
            data[i][2] = p.getType();
            data[i][3] = p.getDescription();
            data[i][4] = p.getCategory();
            data[i][5] = p.getTags();
            data[i][6] = p.getPrice() != null ? p.getPrice().toString() : "";
            data[i][7] = p.getStock() != null ? p.getStock().toString() : "";
            data[i][8] = p.getImage();
            data[i][9] = p.getCreateTime() != null ? p.getCreateTime().format(DATE_FORMATTER) : "";
            data[i][10] = p.getUpdateTime() != null ? p.getUpdateTime().format(DATE_FORMATTER) : "";
        }

        return generateFile("products", headers, data, format);
    }

    @Override
    public Map<String, Object> exportImages(int page, int size, String format) {
        log.info("导出图片: page={}, size={}, format={}", page, size, format);

        if (page < 1) page = 1;
        if (size < 1) size = 100;
        if (size > 1000) size = 1000;

        int offset = (page - 1) * size;

        List<Image> images = imageMapper.selectAllForExport(size, offset);

        String[] headers = {"ID", "文件名", "路径", "分类", "标签", "描述", "宽度", "高度", "格式", "大小", "创建时间"};
        String[][] data = new String[images.size()][headers.length];

        for (int i = 0; i < images.size(); i++) {
            Image img = images.get(i);
            data[i][0] = img.getId() != null ? img.getId().toString() : "";
            data[i][1] = img.getFilename();
            data[i][2] = img.getFilepath();
            data[i][3] = img.getCategory();
            data[i][4] = img.getTags();
            data[i][5] = img.getDescription();
            data[i][6] = img.getWidth() != null ? img.getWidth().toString() : "";
            data[i][7] = img.getHeight() != null ? img.getHeight().toString() : "";
            data[i][8] = img.getFormat();
            data[i][9] = img.getFileSize() != null ? img.getFileSize().toString() : "";
            data[i][10] = img.getCreatedAt() != null ? img.getCreatedAt().format(DATE_FORMATTER) : "";
        }

        return generateFile("images", headers, data, format);
    }

    @Override
    public Map<String, Object> exportStatistics() {
        log.info("导出统计数据");

        try (Workbook workbook = new XSSFWorkbook()) {
            Sheet productSheet = workbook.createSheet("产品统计");
            List<Product> products = productMapper.selectAllForExport(100000, 0);
            Map<String, Long> productTypeCount = products.stream()
                    .collect(Collectors.groupingBy(p -> p.getType() != null ? p.getType() : "未知", Collectors.counting()));

            createStatisticsSheet(productSheet, productTypeCount, "产品类型", "数量");

            Sheet imageSheet = workbook.createSheet("图片统计");
            List<Image> images = imageMapper.selectAllForExport(100000, 0);
            Map<String, Object> imageStats = new LinkedHashMap<>();
            for (Image img : images) {
                String cat = img.getCategory() != null ? img.getCategory() : "未知";
                if (imageStats.containsKey(cat)) {
                    @SuppressWarnings("unchecked")
                    long count = ((Map<String, Object>) imageStats.get(cat)).get("count") == null ? 0 :
                            ((Number) ((Map<String, Object>) imageStats.get(cat)).get("count")).longValue();
                    long size = ((Map<String, Object>) imageStats.get(cat)).get("size") == null ? 0 :
                            ((Number) ((Map<String, Object>) imageStats.get(cat)).get("size")).longValue();
                    imageStats.put(cat, Map.of("count", count + 1, "size", size + (img.getFileSize() != null ? img.getFileSize() : 0)));
                } else {
                    imageStats.put(cat, Map.of("count", 1L, "size", img.getFileSize() != null ? img.getFileSize() : 0));
                }
            }
            createImageStatsSheet(imageSheet, imageStats);

            Sheet userSheet = workbook.createSheet("用户统计");
            List<User> users = userMapper.selectAll();
            Map<String, Long> userRoleCount = users.stream()
                    .collect(Collectors.groupingBy(u -> u.getRole() != null ? u.getRole() : "未知", Collectors.counting()));

            createStatisticsSheet(userSheet, userRoleCount, "用户角色", "数量");

            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            workbook.write(outputStream);

            Map<String, Object> result = new HashMap<>();
            result.put("data", outputStream.toByteArray());
            result.put("filename", "statistics.xlsx");
            result.put("contentType", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            return result;

        } catch (IOException e) {
            log.error("导出统计数据失败", e);
            throw new RuntimeException("导出统计数据失败: " + e.getMessage());
        }
    }

    private void createStatisticsSheet(Sheet sheet, Map<String, Long> data, String header1, String header2) {
        Row headerRow = sheet.createRow(0);
        Cell cell1 = headerRow.createCell(0);
        cell1.setCellValue(header1);
        Cell cell2 = headerRow.createCell(1);
        cell2.setCellValue(header2);

        int rowNum = 1;
        for (Map.Entry<String, Long> entry : data.entrySet()) {
            Row row = sheet.createRow(rowNum++);
            row.createCell(0).setCellValue(entry.getKey());
            row.createCell(1).setCellValue(entry.getValue());
        }
    }

    private void createImageStatsSheet(Sheet sheet, Map<String, Object> data) {
        Row headerRow = sheet.createRow(0);
        headerRow.createCell(0).setCellValue("图片分类");
        headerRow.createCell(1).setCellValue("数量");
        headerRow.createCell(2).setCellValue("总大小(字节)");

        int rowNum = 1;
        for (Map.Entry<String, Object> entry : data.entrySet()) {
            Row row = sheet.createRow(rowNum++);
            row.createCell(0).setCellValue(entry.getKey());
            @SuppressWarnings("unchecked")
            Map<String, Object> stats = (Map<String, Object>) entry.getValue();
            row.createCell(1).setCellValue(stats.get("count") != null ? ((Number) stats.get("count")).longValue() : 0);
            row.createCell(2).setCellValue(stats.get("size") != null ? ((Number) stats.get("size")).longValue() : 0);
        }
    }

    private Map<String, Object> generateFile(String prefix, String[] headers, String[][] data, String format) {
        if ("csv".equalsIgnoreCase(format)) {
            return generateCsv(prefix, headers, data);
        } else {
            return generateExcel(prefix, headers, data);
        }
    }

    private Map<String, Object> generateCsv(String prefix, String[] headers, String[][] data) {
        StringBuilder sb = new StringBuilder();
        sb.append(String.join(",", headers)).append("\n");
        for (String[] row : data) {
            sb.append(String.join(",", Arrays.stream(row).map(this::escapeCsv).toArray(String[]::new))).append("\n");
        }

        Map<String, Object> result = new HashMap<>();
        result.put("data", sb.toString().getBytes());
        result.put("filename", prefix + ".csv");
        result.put("contentType", "text/csv");
        return result;
    }

    private String escapeCsv(String value) {
        if (value == null) return "";
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }

    private Map<String, Object> generateExcel(String prefix, String[] headers, String[][] data) {
        try (Workbook workbook = new XSSFWorkbook()) {
            Sheet sheet = workbook.createSheet("数据列表");

            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerStyle.setFont(headerFont);

            Row headerRow = sheet.createRow(0);
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }

            for (int i = 0; i < data.length; i++) {
                Row row = sheet.createRow(i + 1);
                for (int j = 0; j < data[i].length; j++) {
                    row.createCell(j).setCellValue(data[i][j]);
                }
            }

            for (int i = 0; i < headers.length; i++) {
                sheet.autoSizeColumn(i);
            }

            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            workbook.write(outputStream);

            Map<String, Object> result = new HashMap<>();
            result.put("data", outputStream.toByteArray());
            result.put("filename", prefix + ".xlsx");
            result.put("contentType", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            return result;

        } catch (IOException e) {
            log.error("生成Excel文件失败", e);
            throw new RuntimeException("生成Excel文件失败: " + e.getMessage());
        }
    }
}
