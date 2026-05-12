package com.sjzm.service;

import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

/**
 * 向量搜索服务接口（AI以图搜图）
 */
public interface VectorSearchService {

    /**
     * 搜索相似图片
     */
    List<Map<String, Object>> searchSimilarImages(Long imageId, int limit);

    /**
     * 以图搜图（上传图片搜索）
     */
    List<Map<String, Object>> searchByImage(MultipartFile file, int limit, String category);

    /**
     * 批量索引图片向量
     */
    Map<String, Object> batchIndexImages(List<Long> imageIds);

    /**
     * 索引单个图片向量
     */
    Map<String, Object> indexImage(Long imageId);

    /**
     * 删除图片向量索引
     */
    boolean deleteImageIndex(Long imageId);

    /**
     * 获取向量服务状态
     */
    Map<String, Object> getServiceStatus();

    /**
     * 重建向量索引
     */
    Map<String, Object> rebuildIndex();
}
