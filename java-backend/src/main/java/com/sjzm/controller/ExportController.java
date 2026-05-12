package com.sjzm.controller;

import com.sjzm.common.BusinessException;
import com.sjzm.common.Result;
import com.sjzm.service.ExportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 导出控制器（对齐 Python 的 /export）
 */
@Slf4j
@Tag(name = "导出功能", description = "产品、图片、统计数据导出")
@RestController
@RequestMapping("/api/v1/export")
@RequiredArgsConstructor
public class ExportController {

    private final ExportService exportService;

    @Operation(summary = "导出产品", description = "导出产品数据为 Excel 或 CSV 文件")
    @GetMapping("/products")
    public ResponseEntity<ByteArrayResource> exportProducts(
            @Parameter(description = "页码") @RequestParam(defaultValue = "1") int page,
            @Parameter(description = "每页数量") @RequestParam(defaultValue = "100") int size,
            @Parameter(description = "导出格式：xlsx/csv") @RequestParam(defaultValue = "xlsx") String format) {
        try {
            log.info("导出产品: page={}, size={}, format={}", page, size, format);
            Map<String, Object> result = exportService.exportProducts(page, size, format);

            byte[] data = (byte[]) result.get("data");
            String filename = (String) result.get("filename");
            String contentType = (String) result.get("contentType");

            ByteArrayResource resource = new ByteArrayResource(data);
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType(contentType));
            headers.setContentDisposition(ContentDisposition.builder("attachment")
                    .filename(filename)
                    .build());

            return ResponseEntity.ok().headers(headers).body(resource);

        } catch (Exception e) {
            throw new BusinessException("导出产品失败: " + e.getMessage());
        }
    }

    @Operation(summary = "导出图片", description = "导出图片数据为 Excel 或 CSV 文件")
    @GetMapping("/images")
    public ResponseEntity<ByteArrayResource> exportImages(
            @Parameter(description = "页码") @RequestParam(defaultValue = "1") int page,
            @Parameter(description = "每页数量") @RequestParam(defaultValue = "100") int size,
            @Parameter(description = "导出格式：xlsx/csv") @RequestParam(defaultValue = "xlsx") String format) {
        try {
            log.info("导出图片: page={}, size={}, format={}", page, size, format);
            Map<String, Object> result = exportService.exportImages(page, size, format);

            byte[] data = (byte[]) result.get("data");
            String filename = (String) result.get("filename");
            String contentType = (String) result.get("contentType");

            ByteArrayResource resource = new ByteArrayResource(data);
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType(contentType));
            headers.setContentDisposition(ContentDisposition.builder("attachment")
                    .filename(filename)
                    .build());

            return ResponseEntity.ok().headers(headers).body(resource);

        } catch (Exception e) {
            throw new BusinessException("导出图片失败: " + e.getMessage());
        }
    }

    @Operation(summary = "导出统计数据", description = "导出包含产品、图片、用户统计的 Excel 文件")
    @GetMapping("/statistics")
    public ResponseEntity<ByteArrayResource> exportStatistics() {
        try {
            log.info("导出统计数据");
            Map<String, Object> result = exportService.exportStatistics();

            byte[] data = (byte[]) result.get("data");
            String filename = (String) result.get("filename");
            String contentType = (String) result.get("contentType");

            ByteArrayResource resource = new ByteArrayResource(data);
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType(contentType));
            headers.setContentDisposition(ContentDisposition.builder("attachment")
                    .filename(filename)
                    .build());

            return ResponseEntity.ok().headers(headers).body(resource);

        } catch (Exception e) {
            throw new BusinessException("导出统计数据失败: " + e.getMessage());
        }
    }
}
