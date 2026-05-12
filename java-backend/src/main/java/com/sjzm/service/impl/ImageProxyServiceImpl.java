package com.sjzm.service.impl;

import com.sjzm.common.BusinessException;
import com.sjzm.service.ImageProxyService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 图片代理服务实现（对齐 Python 的 image_proxy）
 * 用于代理 COS 图片访问，解决 CORS 问题
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ImageProxyServiceImpl implements ImageProxyService {

    @Value("${app.cos.public-url:}")
    private String cosPublicUrl;

    @Value("${app.local.thumbnail-dir:uploads/thumbnails}")
    private String localThumbnailDir;

    @Value("${app.proxy.timeout:30000}")
    private int proxyTimeout;

    private static final String[] PREFIXES = {
            "images/", "thumbnails/", "final_drafts/", "reference_images/", "materials/", "carriers/", ""
    };

    @Override
    public Map<String, Object> proxyImage(String objectKey, String url) {
        log.info("代理图片访问: objectKey={}, url={}", objectKey, url);

        if (objectKey == null && url == null) {
            throw new BusinessException(400, "object_key 和 url 不能同时为空");
        }

        try {
            byte[] imageData = null;
            String source = "unknown";

            if (objectKey != null && !objectKey.isEmpty()) {
                url = buildFullUrl(objectKey);
                source = "cos_public";
            }

            if (url != null && !url.isEmpty()) {
                imageData = fetchImageFromUrl(url);
                if (imageData != null) {
                    String filename = generateFilename(url);
                    saveToLocalCache(imageData, filename);
                    return buildResponse(imageData, source);
                }
            }

            if (objectKey != null) {
                imageData = fetchImageFromCosSdk(objectKey);
                if (imageData != null) {
                    saveToLocalCache(imageData, Paths.get(objectKey).getFileName().toString());
                    return buildResponse(imageData, "cos_sdk");
                }
            }

            throw new BusinessException(404, "图片获取失败");

        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("代理图片访问失败", e);
            throw new BusinessException(500, "图片获取失败: " + e.getMessage());
        }
    }

    @Override
    public Map<String, Object> getLocalThumbnail(String filename) {
        log.info("访问本地缩略图: filename={}", filename);

        if (filename == null || filename.trim().isEmpty() || filename.equals(".webp")) {
            throw new BusinessException(400, "无效的文件名");
        }

        try {
            Path localPath = Paths.get(localThumbnailDir, filename);

            if (Files.exists(localPath) && Files.size(localPath) > 0) {
                byte[] imageData = Files.readAllBytes(localPath);
                return buildResponse(imageData, "local");
            }

            for (String prefix : PREFIXES) {
                String objectKey = prefix + filename;
                String url = buildFullUrl(objectKey);
                byte[] imageData = fetchImageFromUrl(url);
                if (imageData != null) {
                    saveToLocalCache(imageData, filename);
                    return buildResponse(imageData, "cos_download");
                }
            }

            throw new BusinessException(404, "图片不存在");

        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("访问本地缩略图失败", e);
            throw new BusinessException(500, "获取图片失败: " + e.getMessage());
        }
    }

    @Override
    public Map<String, Object> getLocalThumbnailByPath(String objectKey) {
        log.info("通过路径访问本地缩略图: objectKey={}", objectKey);

        if (objectKey == null || objectKey.trim().isEmpty()) {
            throw new BusinessException(400, "object_key 不能为空");
        }

        try {
            String filename = Paths.get(objectKey).getFileName().toString();
            Path localPath = Paths.get(localThumbnailDir, filename);

            if (Files.exists(localPath) && Files.size(localPath) > 100) {
                byte[] imageData = Files.readAllBytes(localPath);
                return buildResponse(imageData, "local");
            }

            String url = buildFullUrl(objectKey);
            byte[] imageData = fetchImageFromUrl(url);
            if (imageData != null) {
                saveToLocalCache(imageData, filename);
                return buildResponse(imageData, "cos_public");
            }

            imageData = fetchImageFromCosSdk(objectKey);
            if (imageData != null) {
                saveToLocalCache(imageData, filename);
                return buildResponse(imageData, "cos_sdk");
            }

            throw new BusinessException(404, "图片不存在");

        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("通过路径访问缩略图失败", e);
            throw new BusinessException(500, "获取图片失败: " + e.getMessage());
        }
    }

    @Override
    public Map<String, Object> refreshImageUrl(String objectKey) {
        log.info("刷新图片URL: objectKey={}", objectKey);

        if (objectKey == null || objectKey.trim().isEmpty()) {
            throw new BusinessException(400, "object_key 不能为空");
        }

        String url = buildFullUrl(objectKey);

        Map<String, Object> result = new HashMap<>();
        result.put("url", url);
        result.put("object_key", objectKey);
        return result;
    }

    @Override
    public Map<String, Object> getImageStats() {
        log.info("获取图片统计");

        Map<String, Object> result = new HashMap<>();

        Path thumbnailDir = Paths.get(localThumbnailDir);
        if (!Files.exists(thumbnailDir)) {
            result.put("total_count", 0);
            result.put("total_size_mb", 0);
            result.put("cache_dir", localThumbnailDir);
            return result;
        }

        try {
            long totalSize = 0;
            int fileCount = 0;

            java.util.stream.Stream<Path> stream = Files.list(thumbnailDir);
            List<Path> files = stream.filter(Files::isRegularFile).toList();
            stream.close();

            for (Path file : files) {
                totalSize += Files.size(file);
                fileCount++;
            }

            result.put("total_count", fileCount);
            result.put("total_size_mb", Math.round(totalSize / 1024.0 / 1024.0 * 100.0) / 100.0);
            result.put("cache_dir", localThumbnailDir);

        } catch (IOException e) {
            log.warn("获取本地统计失败", e);
            result.put("total_count", 0);
            result.put("total_size_mb", 0);
            result.put("cache_dir", localThumbnailDir);
        }

        return result;
    }

    private String buildFullUrl(String objectKey) {
        if (objectKey == null) return null;
        String key = objectKey.startsWith("/") ? objectKey.substring(1) : objectKey;
        if (cosPublicUrl != null && !cosPublicUrl.isEmpty()) {
            return cosPublicUrl.endsWith("/") ? cosPublicUrl + key : cosPublicUrl + "/" + key;
        }
        return key;
    }

    private String generateFilename(String url) {
        try {
            MessageDigest md = MessageDigest.getInstance("MD5");
            byte[] digest = md.digest(url.getBytes());
            StringBuilder sb = new StringBuilder();
            for (byte b : digest) {
                sb.append(String.format("%02x", b));
            }
            return "proxy_" + sb.substring(0, 16) + ".webp";
        } catch (Exception e) {
            return "proxy_" + System.currentTimeMillis() + ".webp";
        }
    }

    private byte[] fetchImageFromUrl(String urlStr) {
        try {
            URL url = new URL(urlStr);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(proxyTimeout);
            conn.setReadTimeout(proxyTimeout);
            conn.setRequestProperty("User-Agent", "Mozilla/5.0");

            if (conn.getResponseCode() != 200) {
                conn.disconnect();
                return null;
            }

            try (InputStream is = conn.getInputStream();
                 ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[8192];
                int bytesRead;
                while ((bytesRead = is.read(buffer)) != -1) {
                    baos.write(buffer, 0, bytesRead);
                }
                return baos.toByteArray();
            } finally {
                conn.disconnect();
            }
        } catch (Exception e) {
            log.warn("从URL下载失败: {}, 错误: {}", urlStr, e.getMessage());
            return null;
        }
    }

    private byte[] fetchImageFromCosSdk(String objectKey) {
        log.info("COS SDK 获取暂未实现，使用公有URL模式: {}", objectKey);
        return null;
    }

    private void saveToLocalCache(byte[] data, String filename) {
        try {
            Path cacheDir = Paths.get(localThumbnailDir);
            if (!Files.exists(cacheDir)) {
                Files.createDirectories(cacheDir);
            }
            Path filePath = cacheDir.resolve(filename);
            Files.write(filePath, data);
            log.debug("已保存到本地缓存: {}", filePath);
        } catch (IOException e) {
            log.warn("保存到本地失败: {}, 错误: {}", filename, e.getMessage());
        }
    }

    private Map<String, Object> buildResponse(byte[] data, String source) {
        String contentType = detectContentType(data);

        Map<String, Object> result = new HashMap<>();
        result.put("data", data);
        result.put("contentType", contentType);
        result.put("source", source);
        result.put("size", data.length);
        result.put("headers", buildHeaders(data.length, source));
        return result;
    }

    private String detectContentType(byte[] data) {
        if (data.length < 4) return "image/jpeg";

        if (data[0] == (byte) 0xFF && data[1] == (byte) 0xD8 && data[2] == (byte) 0xFF) {
            return "image/jpeg";
        }
        if (data[0] == (byte) 0x89 && data[1] == (byte) 0x50 && data[2] == (byte) 0x4E && data[3] == (byte) 0x47) {
            return "image/png";
        }
        if (data[0] == (byte) 0x47 && data[1] == (byte) 0x49 && data[2] == (byte) 0x46) {
            return "image/gif";
        }
        if (data[0] == (byte) 0x52 && data[1] == (byte) 0x49 && data[2] == (byte) 0x46 && data[3] == (byte) 0x46) {
            return "image/webp";
        }

        return "image/jpeg";
    }

    private Map<String, String> buildHeaders(int size, String source) {
        Map<String, String> headers = new HashMap<>();
        headers.put("Access-Control-Allow-Origin", "*");
        headers.put("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
        headers.put("Access-Control-Allow-Headers", "Content-Type, Authorization");
        headers.put("Access-Control-Max-Age", "86400");
        headers.put("Cache-Control", "public, max-age=3600");
        headers.put("Content-Length", String.valueOf(size));
        headers.put("X-Image-Size", String.valueOf(size));
        headers.put("X-Image-Source", source);
        return headers;
    }
}
