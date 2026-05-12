package com.sjzm.service.impl;

import com.qcloud.cos.COSClient;
import com.qcloud.cos.ClientConfig;
import com.qcloud.cos.auth.BasicCOSCredentials;
import com.qcloud.cos.auth.COSCredentials;
import com.qcloud.cos.exception.CosClientException;
import com.qcloud.cos.exception.CosServiceException;
import com.qcloud.cos.http.HttpProtocol;
import com.qcloud.cos.model.*;
import com.qcloud.cos.region.Region;
import com.sjzm.common.BusinessException;
import com.sjzm.service.CosStorageService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import javax.annotation.PostConstruct;
import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * 腾讯云 COS 存储服务实现
 * 完整实现 COS SDK 集成，包括上传、下载、删除、批量操作等
 */
@Slf4j
@Service
public class CosStorageServiceImpl implements CosStorageService {

    @Value("${tencent.cos.secret-id:}")
    private String secretId;

    @Value("${tencent.cos.secret-key:}")
    private String secretKey;

    @Value("${tencent.cos.region:ap-guangzhou}")
    private String region;

    @Value("${tencent.cos.bucket:}")
    private String bucket;

    @Value("${tencent.cos.public-domain:}")
    private String publicDomain;

    @Value("${tencent.cos.enabled:false}")
    private boolean cosEnabled;

    @Value("${app.upload.dir:uploads}")
    private String localUploadDir;

    private COSClient cosClient;
    private boolean initialized = false;

    @PostConstruct
    public void init() {
        if (cosEnabled && secretId != null && !secretId.isEmpty() &&
            secretKey != null && !secretKey.isEmpty() &&
            bucket != null && !bucket.isEmpty()) {
            try {
                COSCredentials credentials = new BasicCOSCredentials(secretId, secretKey);
                ClientConfig clientConfig = new ClientConfig(new Region(region));
                clientConfig.setHttpProtocol(HttpProtocol.https);
                clientConfig.setSocketTimeout(30 * 1000);
                clientConfig.setConnectionTimeout(30 * 1000);

                cosClient = new COSClient(credentials, clientConfig);
                initialized = true;
                log.info("COS 客户端初始化成功: region={}, bucket={}", region, bucket);
            } catch (Exception e) {
                log.error("COS 客户端初始化失败", e);
                initialized = false;
            }
        } else {
            log.warn("COS 配置不完整，使用本地存储模式: enabled={}", cosEnabled);
            initialized = false;
        }
    }

    @Override
    public Map<String, Object> uploadFile(byte[] data, String objectKey, String contentType) {
        log.info("上传文件到COS: objectKey={}, size={}, enabled={}", objectKey, data.length, initialized);

        Map<String, Object> result = new LinkedHashMap<>();

        if (!initialized) {
            return uploadToLocal(data, objectKey, contentType, result);
        }

        try {
            ByteArrayInputStream inputStream = new ByteArrayInputStream(data);

            ObjectMetadata metadata = new ObjectMetadata();
            metadata.setContentLength(data.length);
            metadata.setContentType(contentType);

            PutObjectRequest putObjectRequest = new PutObjectRequest(bucket, objectKey, inputStream, metadata);
            PutObjectResult putObjectResult = cosClient.putObject(putObjectRequest);

            String etag = putObjectResult.getETag();
            String url = getFileUrl(objectKey);

            result.put("success", true);
            result.put("url", url);
            result.put("object_key", objectKey);
            result.put("etag", etag);
            result.put("size", data.length);
            result.put("source", "cos");

            log.info("文件上传成功: objectKey={}, etag={}", objectKey, etag);
            return result;

        } catch (CosServiceException e) {
            log.error("COS 服务异常: objectKey={}, error={}", objectKey, e.getErrorMessage());
            return uploadToLocalFallback(data, objectKey, contentType, result, e.getMessage());
        } catch (CosClientException e) {
            log.error("COS 客户端异常: objectKey={}", objectKey, e);
            return uploadToLocalFallback(data, objectKey, contentType, result, e.getMessage());
        }
    }

    @Override
    public Map<String, Object> uploadFile(MultipartFile file, String objectKey) {
        log.info("上传MultipartFile到COS: objectKey={}, fileName={}", objectKey, file.getOriginalFilename());

        try {
            String contentType = file.getContentType();
            if (contentType == null) {
                contentType = "application/octet-stream";
            }
            return uploadFile(file.getBytes(), objectKey, contentType);
        } catch (IOException e) {
            log.error("读取MultipartFile失败: {}", e.getMessage(), e);
            throw new BusinessException("读取上传文件失败: " + e.getMessage());
        }
    }

    @Override
    public Map<String, Object> uploadLocalFile(String localPath, String objectKey) {
        log.info("上传本地文件到COS: localPath={}, objectKey={}", localPath, objectKey);

        Map<String, Object> result = new LinkedHashMap<>();

        if (!initialized) {
            try {
                Path path = Paths.get(localPath);
                if (!Files.exists(path)) {
                    throw new BusinessException(404, "本地文件不存在: " + localPath);
                }
                byte[] data = Files.readAllBytes(path);
                return uploadFile(data, objectKey, "application/octet-stream");
            } catch (IOException e) {
                throw new BusinessException("读取本地文件失败: " + e.getMessage());
            }
        }

        try {
            File localFile = new File(localPath);
            if (!localFile.exists()) {
                throw new BusinessException(404, "本地文件不存在: " + localPath);
            }

            InputStream inputStream = new FileInputStream(localFile);
            ObjectMetadata metadata = new ObjectMetadata();
            metadata.setContentLength(localFile.length());
            metadata.setContentType(getContentType(localFile.getName()));

            PutObjectRequest putObjectRequest = new PutObjectRequest(bucket, objectKey, inputStream, metadata);
            PutObjectResult putObjectResult = cosClient.putObject(putObjectRequest);

            String etag = putObjectResult.getETag();
            String url = getFileUrl(objectKey);

            result.put("success", true);
            result.put("url", url);
            result.put("object_key", objectKey);
            result.put("etag", etag);
            result.put("size", localFile.length());
            result.put("source", "cos");

            return result;

        } catch (IOException e) {
            log.error("上传本地文件失败: {}", e.getMessage(), e);
            throw new BusinessException("上传本地文件失败: " + e.getMessage());
        }
    }

    @Override
    public byte[] downloadFile(String objectKey) {
        log.info("从COS下载文件: objectKey={}", objectKey);

        if (!initialized) {
            return downloadFromLocal(objectKey);
        }

        try {
            GetObjectRequest getObjectRequest = new GetObjectRequest(bucket, objectKey);
            COSObject cosObject = cosClient.getObject(getObjectRequest);

            try (InputStream inputStream = cosObject.getObjectContent();
                 ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {

                byte[] buffer = new byte[8192];
                int bytesRead;
                while ((bytesRead = inputStream.read(buffer)) != -1) {
                    outputStream.write(buffer, 0, bytesRead);
                }
                return outputStream.toByteArray();
            }

        } catch (CosServiceException e) {
            log.error("COS服务异常: objectKey={}, error={}", objectKey, e.getErrorMessage());
            throw new BusinessException("下载文件失败: " + e.getErrorMessage());
        } catch (CosClientException | IOException e) {
            log.error("下载文件失败: objectKey={}", objectKey, e);
            throw new BusinessException("下载文件失败: " + e.getMessage());
        }
    }

    @Override
    public boolean deleteFile(String objectKey) {
        log.info("从COS删除文件: objectKey={}", objectKey);

        if (!initialized) {
            return deleteLocalFile(objectKey);
        }

        try {
            cosClient.deleteObject(bucket, objectKey);
            log.info("文件删除成功: objectKey={}", objectKey);
            return true;
        } catch (CosServiceException e) {
            log.error("COS服务异常: objectKey={}, error={}", objectKey, e.getErrorMessage());
            return false;
        } catch (CosClientException e) {
            log.error("删除文件失败: objectKey={}", objectKey, e);
            return false;
        }
    }

    @Override
    public boolean fileExists(String objectKey) {
        log.debug("检查文件是否存在: objectKey={}", objectKey);

        if (!initialized) {
            return checkLocalFileExists(objectKey);
        }

        try {
            GetObjectMetadataRequest request = new GetObjectMetadataRequest(bucket, objectKey);
            cosClient.getObjectMetadata(request);
            return true;
        } catch (CosServiceException e) {
            if (e.getStatusCode() == 404) {
                return false;
            }
            log.error("检查文件存在失败: objectKey={}", objectKey, e);
            return false;
        } catch (CosClientException e) {
            log.error("检查文件存在失败: objectKey={}", objectKey, e);
            return false;
        }
    }

    @Override
    public String getFileUrl(String objectKey) {
        if (publicDomain != null && !publicDomain.isEmpty()) {
            String baseUrl = publicDomain.endsWith("/") ? publicDomain : publicDomain + "/";
            return baseUrl + objectKey;
        }

        if (initialized) {
            return String.format("https://%s.cos.%s.myqcloud.com/%s", bucket, region, objectKey);
        }

        return "/uploads/" + objectKey;
    }

    @Override
    public Map<String, Object> batchUploadFiles(Map<String, MultipartFile> files, String prefix) {
        log.info("批量上传文件: count={}, prefix={}", files.size(), prefix);

        Map<String, Object> result = new LinkedHashMap<>();
        Map<String, Object> success = new LinkedHashMap<>();
        Map<String, Object> failed = new LinkedHashMap<>();
        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger failedCount = new AtomicInteger(0);

        files.forEach((filename, file) -> {
            String objectKey = (prefix != null ? prefix + "/" : "") + filename;
            try {
                Map<String, Object> uploadResult = uploadFile(file, objectKey);
                success.put(filename, uploadResult);
                successCount.incrementAndGet();
            } catch (Exception e) {
                Map<String, Object> errorInfo = new LinkedHashMap<>();
                errorInfo.put("error", e.getMessage());
                failed.put(filename, errorInfo);
                failedCount.incrementAndGet();
                log.warn("文件上传失败: filename={}, error={}", filename, e.getMessage());
            }
        });

        result.put("total", files.size());
        result.put("success_count", successCount.get());
        result.put("failed_count", failedCount.get());
        result.put("success", success);
        result.put("failed", failed);

        return result;
    }

    @Override
    public Map<String, Object> getBucketInfo() {
        Map<String, Object> info = new LinkedHashMap<>();

        if (!initialized) {
            info.put("enabled", false);
            info.put("mode", "local");
            info.put("message", "COS 未配置，使用本地存储");
            return info;
        }

        info.put("enabled", true);
        info.put("mode", "cos");
        info.put("region", region);
        info.put("bucket", bucket);
        info.put("public_domain", publicDomain);

        try {
            HeadBucketRequest headBucketRequest = new HeadBucketRequest(bucket);
            HeadBucketResult headBucketResult = cosClient.headBucket(headBucketRequest);
            info.put("bucket_exists", true);
            info.put("status_code", "OK");
        } catch (Exception e) {
            info.put("bucket_exists", false);
            info.put("error", e.getMessage());
        }

        return info;
    }

    private Map<String, Object> uploadToLocal(byte[] data, String objectKey, String contentType, Map<String, Object> result) {
        try {
            Path path = Paths.get(localUploadDir, objectKey);
            Files.createDirectories(path.getParent());
            Files.write(path, data);

            String url = "/uploads/" + objectKey;

            result.put("success", true);
            result.put("url", url);
            result.put("object_key", objectKey);
            result.put("size", data.length);
            result.put("source", "local");

            log.info("文件保存到本地: path={}", path);
            return result;

        } catch (IOException e) {
            log.error("保存到本地失败: objectKey={}", objectKey, e);
            result.put("success", false);
            result.put("error", e.getMessage());
            return result;
        }
    }

    private Map<String, Object> uploadToLocalFallback(byte[] data, String objectKey, String contentType,
                                                       Map<String, Object> result, String errorMsg) {
        log.warn("COS上传失败，回退到本地存储: objectKey={}, error={}", objectKey, errorMsg);
        return uploadToLocal(data, objectKey, contentType, result);
    }

    private byte[] downloadFromLocal(String objectKey) {
        try {
            Path path = Paths.get(localUploadDir, objectKey);
            if (!Files.exists(path)) {
                throw new BusinessException(404, "文件不存在: " + objectKey);
            }
            return Files.readAllBytes(path);
        } catch (IOException e) {
            throw new BusinessException("读取本地文件失败: " + e.getMessage());
        }
    }

    private boolean deleteLocalFile(String objectKey) {
        try {
            Path path = Paths.get(localUploadDir, objectKey);
            return Files.deleteIfExists(path);
        } catch (IOException e) {
            log.error("删除本地文件失败: objectKey={}", objectKey, e);
            return false;
        }
    }

    private boolean checkLocalFileExists(String objectKey) {
        Path path = Paths.get(localUploadDir, objectKey);
        return Files.exists(path);
    }

    private String getContentType(String filename) {
        String ext = filename.substring(filename.lastIndexOf(".") + 1).toLowerCase();
        switch (ext) {
            case "jpg":
            case "jpeg":
                return "image/jpeg";
            case "png":
                return "image/png";
            case "gif":
                return "image/gif";
            case "webp":
                return "image/webp";
            case "pdf":
                return "application/pdf";
            case "xlsx":
            case "xls":
                return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            default:
                return "application/octet-stream";
        }
    }
}
