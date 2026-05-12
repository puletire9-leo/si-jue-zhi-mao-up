package com.sjzm.controller;

import com.sjzm.common.BusinessException;
import com.sjzm.common.Result;
import com.sjzm.service.LingxingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

/**
 * 凌猩对接控制器（对齐 Python 的 /lingxing）
 */
@Slf4j
@Tag(name = "凌猩对接", description = "凌猩导入模板下载、图片上传、导入文件生成")
@RestController
@RequestMapping("/api/v1/lingxing")
@RequiredArgsConstructor
public class LingxingController {

    private final LingxingService lingxingService;

    @Operation(summary = "下载凌猩导入模板", description = "下载凌猩导入模板Excel文件")
    @GetMapping("/download-template")
    public ResponseEntity<ByteArrayResource> downloadTemplate() {
        try {
            byte[] template = lingxingService.getTemplate();

            ByteArrayResource resource = new ByteArrayResource(template);
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType(
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
            headers.setContentDisposition(ContentDisposition.builder("attachment")
                    .filename("产品汇总表-模版.xlsx")
                    .build());

            return ResponseEntity.ok().headers(headers).body(resource);

        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("下载模板失败: " + e.getMessage());
        }
    }

    @Operation(summary = "上传图片到凌猩COS", description = "上传图片到凌猩专用的腾讯云COS")
    @PostMapping("/upload-image")
    public Result<Map<String, Object>> uploadImage(
            @Parameter(description = "图片文件") @RequestParam("file") MultipartFile file) {
        try {
            if (file == null || file.isEmpty()) {
                return Result.error("请上传图片文件");
            }
            Map<String, Object> result = lingxingService.uploadImage(file);
            return Result.success(result);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("上传图片失败: " + e.getMessage());
        }
    }

    @Operation(summary = "生成凌猩导入文件", description = "执行Python脚本生成凌猩导入文件")
    @PostMapping("/generate-import-file")
    public Result<Map<String, Object>> generateImportFile(
            @Parameter(description = "开发人名称") @RequestParam(required = false) String developer) {
        try {
            if (developer == null || developer.trim().isEmpty()) {
                developer = "";
            }
            Map<String, Object> result = lingxingService.generateImportFile(developer);
            return Result.success(result);
        } catch (BusinessException e) {
            return Result.error(e.getCode(), e.getMessage());
        } catch (Exception e) {
            return Result.error("生成导入文件失败: " + e.getMessage());
        }
    }
}
