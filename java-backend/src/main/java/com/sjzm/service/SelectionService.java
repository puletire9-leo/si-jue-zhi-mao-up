package com.sjzm.service;

import com.sjzm.common.PageResult;
import com.sjzm.entity.Selection;

import java.util.List;
import java.util.Map;

/**
 * 选品服务接口
 */
public interface SelectionService {

    /**
     * 分页查询选品
     */
    PageResult<Selection> listSelections(int page, int size, String keyword, String productType,
                                         String source, String country, String dataFilterMode);

    /**
     * 根据ID获取选品
     */
    Selection getSelectionById(Long id);

    /**
     * 根据ASIN获取选品
     */
    Selection getSelectionByAsin(String asin);

    /**
     * 创建选品
     */
    Selection createSelection(Selection selection);

    /**
     * 更新选品
     */
    Selection updateSelection(Long id, Selection selection);

    /**
     * 删除选品
     */
    void deleteSelection(Long id);

    /**
     * 批量删除选品
     */
    Map<String, Object> batchDeleteSelections(List<Long> ids);

    /**
     * 批量导入选品
     */
    Map<String, Object> batchImportSelections(List<Selection> selections, boolean overwrite);

    /**
     * 批量更新选品
     * 支持根据ASIN或ID批量更新选品信息
     */
    Map<String, Object> batchUpdateSelections(List<Selection> selections);

    /**
     * 根据ID列表批量更新选品标签
     */
    Map<String, Object> batchUpdateTags(List<Long> ids, String tags);

    /**
     * 根据ID列表批量更新选品备注
     */
    Map<String, Object> batchUpdateNotes(List<Long> ids, String notes);

    /**
     * 根据ID列表批量更新选品评分和等级
     */
    Map<String, Object> batchUpdateScores(List<Long> ids, Double score, String grade);

    /**
     * 获取选品统计
     */
    Map<String, Object> getSelectionStats();
}
