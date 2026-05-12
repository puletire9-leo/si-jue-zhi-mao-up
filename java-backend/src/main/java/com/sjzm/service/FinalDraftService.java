package com.sjzm.service;

import com.sjzm.common.PageResult;
import com.sjzm.entity.FinalDraft;
import com.sjzm.entity.FinalDraftRecycleBin;

import java.util.List;
import java.util.Map;

/**
 * 定稿服务接口
 */
public interface FinalDraftService {

    /**
     * 分页查询定稿
     */
    PageResult<FinalDraft> listFinalDrafts(int page, int size, String searchType, String searchContent,
                                            List<String> developers, List<String> statuses, List<String> carriers);

    /**
     * 根据ID获取定稿
     */
    FinalDraft getFinalDraftById(Long id);

    /**
     * 根据SKU获取定稿
     */
    FinalDraft getFinalDraftBySku(String sku);

    /**
     * 创建定稿
     */
    FinalDraft createFinalDraft(FinalDraft finalDraft);

    /**
     * 更新定稿
     */
    FinalDraft updateFinalDraft(Long id, FinalDraft finalDraft);

    /**
     * 删除定稿（移动到回收站）
     */
    void deleteFinalDraft(Long id);

    /**
     * 批量删除定稿（移动到回收站）
     */
    Map<String, Object> batchDeleteFinalDrafts(List<Long> ids);

    /**
     * 批量导入定稿
     */
    Map<String, Object> batchImportFinalDrafts(List<FinalDraft> finalDrafts);

    /**
     * 分页查询回收站定稿
     */
    PageResult<FinalDraftRecycleBin> listRecycleBin(int page, int size);

    /**
     * 恢复定稿
     */
    void restoreMaterial(String sku);

    /**
     * 批量恢复定稿
     */
    Map<String, Object> batchRestoreMaterials(List<String> skus);

    /**
     * 永久删除定稿
     */
    void permanentDeleteMaterial(String sku);

    /**
     * 批量永久删除定稿
     */
    Map<String, Object> batchPermanentDeleteMaterials(List<String> skus);

    /**
     * 清空回收站
     */
    Map<String, Object> clearRecycleBin();
}
