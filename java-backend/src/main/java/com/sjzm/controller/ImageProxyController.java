package com.sjzm.controller;

import com.sjzm.common.BusinessException;
import com.sjzm.common.Result;
import com.sjzm.service.ImageProxyService;
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
 * 图片代理控制器（对齐 Python 的 /image-proxy）
 * 统一图片代理服务，用于代理 COS 图片访问，解决 CORS 问题
 */
@Slf4j
@Tag(name = "图片代理服务", description = "统一图片代理、CORS解决、本地缓存管理")
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class ImageProxyController {

    private final ImageProxyService imageProxyService;

    @Operation(summary = "代理图片访问", description = "代理 COS 图片访问，解决 CORS 问题。先尝试公有 URL 下载，失败后回退到 COS SDK")
    @GetMapping("/image-proxy/proxy")
    public ResponseEntity<ByteArrayResource> proxyImage(
            @Parameter(description = "COS对象键") @RequestParam(required = false) String objectKey,
            @Parameter(description = "完整图片URL") @RequestParam(required = false) String url) {
        try {
            Map<String, Object> result = imageProxyService.proxyImage(objectKey, url);
            byte[] data = (byte[]) result.get("data");
            String contentType = (String) result.get("contentType");
            @SuppressWarnings("unchecked")
            Map<String, String> headers = (Map<String, String>) result.get("headers");

            HttpHeaders responseHeaders = new HttpHeaders();
            responseHeaders.setContentType(MediaType.parseMediaType(contentType));
            if (headers != null) {
                headers.forEach((key, value) -> {
                    if (!key.equalsIgnoreCase("Content-Type")) {
                        responseHeaders.set(key, value);
                    }
                });
            }

            ByteArrayResource resource = new ByteArrayResource(data);
            return ResponseEntity.ok().headers(responseHeaders).body(resource);

        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("代理图片访问失败: " + e.getMessage());
        }
    }

    @Operation(summary = "访问本地缩略图", description = "访问本地缩略图，如果本地不存在则自动从 COS 下载")
    @GetMapping("/image-proxy/local")
    public ResponseEntity<ByteArrayResource> getLocalThumbnail(
            @Parameter(description = "缩略图文件名") @RequestParam String filename) {
        try {
            Map<String, Object> result = imageProxyService.getLocalThumbnail(filename);
            byte[] data = (byte[]) result.get("data");
            String contentType = (String) result.get("contentType");
            @SuppressWarnings("unchecked")
            Map<String, String> headers = (Map<String, String>) result.get("headers");

            HttpHeaders responseHeaders = new HttpHeaders();
            responseHeaders.setContentType(MediaType.parseMediaType(contentType));
            if (headers != null) {
                headers.forEach((key, value) -> {
                    if (!key.equalsIgnoreCase("Content-Type")) {
                        responseHeaders.set(key, value);
                    }
                });
            }

            ByteArrayResource resource = new ByteArrayResource(data);
            return ResponseEntity.ok().headers(responseHeaders).body(resource);

        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("获取本地缩略图失败: " + e.getMessage());
        }
    }

    @Operation(summary = "通过完整路径访问本地缩略图", description = "通过完整的 COS 对象键访问图片，先检查本地缓存再从 COS 下载")
    @GetMapping("/image-proxy/local-by-path")
    public ResponseEntity<ByteArrayResource> getLocalThumbnailByPath(
            @Parameter(description = "COS对象键") @RequestParam String objectKey) {
        try {
            Map<String, Object> result = imageProxyService.getLocalThumbnailByPath(objectKey);
            byte[] data = (byte[]) result.get("data");
            String contentType = (String) result.get("contentType");
            @SuppressWarnings("unchecked")
            Map<String, String> headers = (Map<String, String>) result.get("headers");

            HttpHeaders responseHeaders = new HttpHeaders();
            responseHeaders.setContentType(MediaType.parseMediaType(contentType));
            if (headers != null) {
                headers.forEach((key, value) -> {
                    if (!key.equalsIgnoreCase("Content-Type")) {
                        responseHeaders.set(key, value);
                    }
                });
            }

            ByteArrayResource resource = new ByteArrayResource(data);
            return ResponseEntity.ok().headers(responseHeaders).body(resource);

        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("获取本地缩略图失败: " + e.getMessage());
        }
    }

    @Operation(summary = "刷新图片URL", description = "生成新的图片访问 URL（公有读模式下直接返回完整 URL）")
    @PostMapping("/image-proxy/refresh")
    public Result<Map<String, Object>> refreshImageUrl(@RequestBody Map<String, Object> request) {
        try {
            String objectKey = (String) request.get("object_key");
            Map<String, Object> result = imageProxyService.refreshImageUrl(objectKey);
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("刷新图片URL失败: " + e.getMessage());
        }
    }

    @Operation(summary = "获取图片统计", description = "获取本地缓存统计信息")
    @GetMapping("/image/stats")
    public Result<Map<String, Object>> getImageStats() {
        try {
            Map<String, Object> result = imageProxyService.getImageStats();
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("获取图片统计失败: " + e.getMessage());
        }
    }
}
