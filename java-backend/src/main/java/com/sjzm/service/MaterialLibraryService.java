package com.sjzm.service;

import com.sjzm.common.PageResult;
import com.sjzm.entity.MaterialLibrary;
import com.sjzm.entity.MaterialLibraryRecycleBin;

import java.util.List;
import java.util.Map;

/**
 * 素材库服务接口
 */
public interface MaterialLibraryService {

    /**
     * 分页查询素材
     */
    PageResult<MaterialLibrary> listMaterials(int page, int size, String searchType, String searchContent,
                                               List<String> developers, List<String> statuses, List<String> carriers);

    /**
     * 根据ID获取素材
     */
    MaterialLibrary getMaterialById(Long id);

    /**
     * 根据SKU获取素材
     */
    MaterialLibrary getMaterialBySku(String sku);

    /**
     * 创建素材
     */
    MaterialLibrary createMaterial(MaterialLibrary material);

    /**
     * 更新素材（移动到回收站）
     */
    MaterialLibrary updateMaterial(Long id, MaterialLibrary material);

    /**
     * 删除素材（移动到回收站）
     */
    void deleteMaterial(Long id);

    /**
     * 批量删除素材（移动到回收站）
     */
    Map<String, Object> batchDeleteMaterials(List<Long> ids);

    /**
     * 批量导入素材
     */
    Map<String, Object> batchImportMaterials(List<MaterialLibrary> materials);

    /**
     * 分页查询回收站素材
     */
    PageResult<MaterialLibraryRecycleBin> listRecycleBin(int page, int size);

    /**
     * 恢复素材
     */
    void restoreMaterial(String sku);

    /**
     * 批量恢复素材
     */
    Map<String, Object> batchRestoreMaterials(List<String> skus);

    /**
     * 永久删除素材
     */
    void permanentDeleteMaterial(String sku);

    /**
     * 批量永久删除素材
     */
    Map<String, Object> batchPermanentDeleteMaterials(List<String> skus);

    /**
     * 清空回收站
     */
    Map<String, Object> clearRecycleBin();

    /**
     * 获取元素词库
     */
    List<String> getElementTags();

    /**
     * 更新元素词库
     */
    Map<String, Object> updateElementTags(List<String> elements);

    /**
     * AI分析图片（占位实现）
     */
    Map<String, Object> analyzeImage(Map<String, Object> request);

    /**
     * AI详细分析图片（占位实现）
     */
    Map<String, Object> analyzeImageDetailed(Map<String, Object> request);

    /**
     * 处理本地文件（占位实现）
     */
    Map<String, Object> processLocalFiles(Map<String, Object> request);
}
