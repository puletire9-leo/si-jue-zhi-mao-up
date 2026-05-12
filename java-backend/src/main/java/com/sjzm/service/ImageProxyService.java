package com.sjzm.service;

import java.util.Map;

/**
 * 图片代理服务接口（对齐 Python 的 image_proxy）
 */
public interface ImageProxyService {

    /**
     * 代理图片访问
     */
    Map<String, Object> proxyImage(String objectKey, String url);

    /**
     * 访问本地缩略图
     */
    Map<String, Object> getLocalThumbnail(String filename);

    /**
     * 通过完整路径访问本地缩略图
     */
    Map<String, Object> getLocalThumbnailByPath(String objectKey);

    /**
     * 刷新图片URL
     */
    Map<String, Object> refreshImageUrl(String objectKey);

    /**
     * 获取图片统计
     */
    Map<String, Object> getImageStats();
}
