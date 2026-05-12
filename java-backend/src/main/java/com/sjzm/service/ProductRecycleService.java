package com.sjzm.service;

import com.sjzm.common.PageResult;

import java.util.List;
import java.util.Map;

/**
 * 产品回收站服务接口
 */
public interface ProductRecycleService {

    /**
     * 分页查询回收站产品
     */
    PageResult<Map<String, Object>> listRecycleProducts(int page, int size, String keyword);

    /**
     * 获取回收站统计
     */
    Map<String, Object> getRecycleStats();

    /**
     * 恢复产品
     */
    void restoreProduct(String sku);

    /**
     * 批量恢复产品
     */
    Map<String, Object> batchRestoreProducts(List<String> skus);

    /**
     * 永久删除产品
     */
    void permanentlyDeleteProduct(String sku);

    /**
     * 批量永久删除产品
     */
    Map<String, Object> batchPermanentlyDeleteProducts(List<String> skus);

    /**
     * 清理过期产品
     */
    Map<String, Object> clearExpiredProducts();

    /**
     * 清理过期产品（指定天数）
     */
    Map<String, Object> clearExpiredProducts(int days);
}
