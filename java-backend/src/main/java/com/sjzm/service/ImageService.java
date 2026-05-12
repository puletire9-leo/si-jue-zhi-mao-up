package com.sjzm.service;

import com.sjzm.common.PageResult;
import com.sjzm.entity.Image;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

/**
 * 图片服务接口（对齐 Python 的 ImageService）
 */
public interface ImageService {

    /**
     * 上传图片
     */
    Map<String, Object> uploadImage(MultipartFile file, String category, String tags, String description, String sku);

    /**
     * 批量上传图片
     */
    Map<String, Object> batchUploadImages(List<MultipartFile> files, String category, String tags, String description, String sku);

    /**
     * 获取图片详情
     */
    Map<String, Object> getImageById(Long id);

    /**
     * 获取图片列表
     */
    PageResult<Map<String, Object>> listImages(int page, int size, String keyword, String category);

    /**
     * 搜索图片
     */
    List<Map<String, Object>> searchImages(String keyword, String category, int limit, int offset);

    /**
     * 获取所有产品图片
     */
    List<Map<String, Object>> getAllProductImages(int limit, int offset);

    /**
     * 更新图片信息
     */
    boolean updateImage(Long id, String category, String tags, String description);

    /**
     * 删除图片
     */
    boolean deleteImage(Long id);

    /**
     * 批量删除图片
     */
    Map<String, Object> batchDeleteImages(List<Long> ids);

    /**
     * 获取图片统计
     */
    Map<String, Object> getImageStats(String category);

    /**
     * 批量获取图片信息
     */
    Map<String, Object> batchGetImages(List<Long> imageIds);

    /**
     * 批量刷新图片URL
     */
    Map<String, Object> refreshImageUrls(List<Long> imageIds, String category, int limit, int offset);

    /**
     * 搜索相似图片（AI向量搜索）
     */
    List<Map<String, Object>> searchSimilarImages(Long imageId, int limit);

    /**
     * 以图搜图（AI向量搜索）
     */
    List<Map<String, Object>> searchSimilarByFile(MultipartFile file, int limit, String category);

    /**
     * 索引图片向量
     */
    Map<String, Object> indexImageVector(Long imageId);

    /**
     * 批量索引图片向量
     */
    Map<String, Object> batchIndexImageVectors(List<Long> imageIds);

    /**
     * 获取图片文件路径
     */
    String getImageFilepath(Long id);

    /**
     * 获取缩略图路径
     */
    String getThumbnailPath(Long id);

    /**
     * 获取向量服务状态
     */
    Map<String, Object> getVectorServiceStatus();
}
