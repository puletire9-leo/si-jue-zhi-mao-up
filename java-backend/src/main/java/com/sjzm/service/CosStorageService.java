package com.sjzm.service;

import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

/**
 * 腾讯云 COS 存储服务接口
 */
public interface CosStorageService {

    /**
     * 上传文件到 COS
     */
    Map<String, Object> uploadFile(byte[] data, String objectKey, String contentType);

    /**
     * 上传 MultipartFile 到 COS
     */
    Map<String, Object> uploadFile(MultipartFile file, String objectKey);

    /**
     * 上传本地文件到 COS
     */
    Map<String, Object> uploadLocalFile(String localPath, String objectKey);

    /**
     * 下载文件
     */
    byte[] downloadFile(String objectKey);

    /**
     * 删除文件
     */
    boolean deleteFile(String objectKey);

    /**
     * 检查文件是否存在
     */
    boolean fileExists(String objectKey);

    /**
     * 获取文件访问 URL
     */
    String getFileUrl(String objectKey);

    /**
     * 批量上传文件
     */
    Map<String, Object> batchUploadFiles(Map<String, MultipartFile> files, String prefix);

    /**
     * 获取 COS 存储桶信息
     */
    Map<String, Object> getBucketInfo();
}
