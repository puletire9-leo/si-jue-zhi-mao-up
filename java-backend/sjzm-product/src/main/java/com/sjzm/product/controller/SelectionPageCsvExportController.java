package com.sjzm.product.controller;

import com.sjzm.product.dto.SelectionPageCsvExportRequest;
import com.sjzm.product.service.SelectionPageCsvExportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;

@RestController
@RequestMapping("/api/v1/competitor")
@RequiredArgsConstructor
@Tag(name = "选品 CSV 导出", description = "统一选品框架全部筛选结果完整数据库字段导出")
public class SelectionPageCsvExportController {

    private final SelectionPageCsvExportService exportService;

    @PostMapping("/export-current-page")
    @Operation(summary = "导出全部筛选结果的完整数据库字段 CSV")
    public ResponseEntity<byte[]> exportCurrentPage(
            @Valid @RequestBody SelectionPageCsvExportRequest request
    ) {
        SelectionPageCsvExportService.CsvExport export = exportService.exportCurrentPage(request);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(new MediaType("text", "csv", StandardCharsets.UTF_8));
        headers.setContentDisposition(ContentDisposition.attachment()
                .filename(export.filename(), StandardCharsets.UTF_8)
                .build());
        headers.set("X-Exported-Rows", String.valueOf(export.exportedRows()));
        return ResponseEntity.ok().headers(headers).body(export.content());
    }
}
