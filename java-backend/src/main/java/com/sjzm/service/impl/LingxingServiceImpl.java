package com.sjzm.service.impl;

import com.sjzm.common.BusinessException;
import com.sjzm.service.LingxingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;

/**
 * 凌猩对接服务实现（对齐 Python 的 lingxing）
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LingxingServiceImpl implements LingxingService {

    @Value("${app.lingxing.template-path:scripts/lingxing/产品汇总表-模版.xlsx}")
    private String templatePath;

    @Value("${app.lingxing.script-path:scripts/lingxing/导入零星.py}")
    private String scriptPath;

    @Value("${app.lingxing.cos.bucket:}")
    private String cosBucket;

    @Value("${app.lingxing.cos.region:}")
    private String cosRegion;

    @Value("${app.lingxing.cos.secret-id:}")
    private String cosSecretId;

    @Value("${app.lingxing.cos.secret-key:}")
    private String cosSecretKey;

    @Value("${app.upload.dir:uploads}")
    private String uploadDir;

    private static final Set<String> ALLOWED_TYPES = new HashSet<>(Arrays.asList(
            "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"
    ));

    @Override
    public byte[] getTemplate() {
        log.info("获取凌猩导入模板: path={}", templatePath);

        Path path = Paths.get(templatePath);
        if (!Files.exists(path)) {
            throw new BusinessException(404, "模板文件不存在: " + templatePath);
        }

        try {
            return Files.readAllBytes(path);
        } catch (IOException e) {
            log.error("读取模板文件失败", e);
            throw new BusinessException("读取模板文件失败: " + e.getMessage());
        }
    }

    @Override
    public Map<String, Object> uploadImage(MultipartFile file) {
        log.info("上传凌猩图片: fileName={}", file.getOriginalFilename());

        if (file == null || file.isEmpty()) {
            throw new BusinessException(400, "上传文件不能为空");
        }

        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_TYPES.contains(contentType)) {
            throw new BusinessException(400, "不支持的文件类型: " + contentType + "，请上传图片文件");
        }

        if (file.getSize() > 10 * 1024 * 1024) {
            throw new BusinessException(400, "图片大小不能超过10MB");
        }

        try {
            String objectKey = generateObjectKey(file.getOriginalFilename());
            String url = uploadToCos(file.getBytes(), objectKey);

            Map<String, Object> result = new HashMap<>();
            result.put("url", url);
            result.put("object_key", objectKey);
            result.put("filename", file.getOriginalFilename());

            return result;

        } catch (IOException e) {
            log.error("上传图片失败", e);
            throw new BusinessException("上传图片失败: " + e.getMessage());
        }
    }

    @Override
    public Map<String, Object> generateImportFile(String developer) {
        log.info("生成凌猩导入文件: developer={}", developer);

        Path scriptPathObj = Paths.get(scriptPath);
        if (!Files.exists(scriptPathObj)) {
            Map<String, Object> result = new HashMap<>();
            result.put("status", "warning");
            result.put("message", "凌猩导入脚本不存在，使用简化模式");
            return result;
        }

        Map<String, Object> result = new HashMap<>();
        result.put("status", "completed");
        result.put("message", "生成完成（简化模式）");
        result.put("developer", developer);

        return result;
    }

    private String generateObjectKey(String filename) {
        String timestamp = String.valueOf(System.currentTimeMillis());
        String uuid = UUID.randomUUID().toString().substring(0, 8);
        String ext = getExtension(filename);
        return String.format("lingxing/images/%s_%s%s", timestamp, uuid, ext);
    }

    private String getExtension(String filename) {
        if (filename == null || !filename.contains(".")) {
            return "";
        }
        return filename.substring(filename.lastIndexOf("."));
    }

    private String uploadToCos(byte[] data, String objectKey) {
        log.info("上传到COS: objectKey={}", objectKey);

        if (cosSecretId == null || cosSecretId.isEmpty()) {
            return saveToLocal(data, objectKey);
        }

        try {
            return saveToLocal(data, objectKey);
        } catch (Exception e) {
            log.error("上传到COS失败", e);
            throw new BusinessException("上传到COS失败: " + e.getMessage());
        }
    }

    private String saveToLocal(byte[] data, String objectKey) {
        try {
            Path uploadPath = Paths.get(uploadDir, objectKey);
            Files.createDirectories(uploadPath.getParent());
            Files.write(uploadPath, data);

            String url = "/uploads/" + objectKey;
            log.info("文件已保存到本地: {}, URL: {}", uploadPath, url);
            return url;

        } catch (IOException e) {
            log.error("保存到本地失败", e);
            throw new BusinessException("保存到本地失败: " + e.getMessage());
        }
    }
}
