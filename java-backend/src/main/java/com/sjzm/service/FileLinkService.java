package com.sjzm.service;

import com.sjzm.common.PageResult;

import java.util.List;
import java.util.Map;

/**
 * 文件链接服务接口（对齐 Python 的 file_links）
 */
public interface FileLinkService {

    /**
     * 创建文件链接
     */
    Map<String, Object> createFileLink(Map<String, Object> data);

    /**
     * 获取文件链接列表
     */
    PageResult<Map<String, Object>> getFileLinks(String libraryType, int page, int size, 
                                                  String keyword, String category, String linkType, String status);

    /**
     * 获取单个文件链接
     */
    Map<String, Object> getFileLink(Long id);

    /**
     * 更新文件链接
     */
    Map<String, Object> updateFileLink(Long id, Map<String, Object> data);

    /**
     * 删除文件链接
     */
    boolean deleteFileLink(Long id);

    /**
     * 批量删除文件链接
     */
    Map<String, Object> batchDeleteFileLinks(List<Long> ids);

    /**
     * 检查链接状态
     */
    Map<String, Object> checkLinkStatus(Long id);

    /**
     * 获取分类列表
     */
    List<String> getCategories(String libraryType);

    /**
     * 获取上传统计
     */
    Map<String, Object> getUploadStats();
}
