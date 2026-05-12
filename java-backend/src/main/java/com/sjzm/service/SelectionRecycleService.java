package com.sjzm.service;

import com.sjzm.common.PageResult;

import java.util.List;
import java.util.Map;

/**
 * 选品回收站服务接口
 */
public interface SelectionRecycleService {

    /**
     * 分页查询回收站选品
     */
    PageResult<Map<String, Object>> listRecycleProducts(int page, int size, String keyword);

    /**
     * 获取回收站统计
     */
    Map<String, Object> getRecycleStats();

    /**
     * 恢复选品
     */
    void restoreSelection(Long id);

    /**
     * 批量恢复选品
     */
    Map<String, Object> batchRestoreSelections(List<Long> ids);

    /**
     * 永久删除选品
     */
    void permanentlyDeleteSelection(Long id);

    /**
     * 批量永久删除选品
     */
    Map<String, Object> batchPermanentlyDeleteSelections(List<Long> ids);

    /**
     * 根据ASIN永久删除选品
     */
    Map<String, Object> permanentlyDeleteByAsins(List<String> asins);

    /**
     * 清空回收站
     */
    Map<String, Object> clearRecycleBin();

    /**
     * 清理过期选品
     */
    Map<String, Object> clearExpiredProducts(int days);
}
