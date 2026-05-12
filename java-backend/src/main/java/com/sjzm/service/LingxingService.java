package com.sjzm.service;

import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

/**
 * 凌猩对接服务接口（对齐 Python 的 lingxing）
 */
public interface LingxingService {

    /**
     * 获取凌猩导入模板
     */
    byte[] getTemplate();

    /**
     * 上传图片到凌猩 COS
     */
    Map<String, Object> uploadImage(MultipartFile file);

    /**
     * 生成凌猩导入文件
     */
    Map<String, Object> generateImportFile(String developer);
}
