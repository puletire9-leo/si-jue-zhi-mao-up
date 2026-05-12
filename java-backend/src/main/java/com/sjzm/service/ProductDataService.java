package com.sjzm.service;

import java.util.List;
import java.util.Map;

/**
 * 产品数据服务接口（对齐 Python 的 product_data）
 */
public interface ProductDataService {

    /**
     * 获取可用的数据月份
     */
    List<String> getAvailableMonths();

    /**
     * 获取分类统计
     */
    Map<String, Object> getCategoryStats(String startDate, String endDate, String month,
                                         String store, String country, String developer);

    /**
     * 获取产品列表
     */
    Map<String, Object> getProducts(int page, int size, String startDate, String endDate,
                                     String store, String country, String category, String month,
                                     String developer, String searchKeyword, String sortField, String sortOrder);

    /**
     * 导出产品数据
     */
    byte[] exportProducts(String startDate, String endDate, String store, String country,
                          String category, String month, String developer, String searchKeyword);

    /**
     * 获取销售趋势
     */
    Map<String, Object> getSalesTrend(String startDate, String endDate, String timeDimension,
                                      int months, String category, String store, String country, String developer);

    /**
     * 获取TOP产品
     */
    Map<String, Object> getTopProducts(String startDate, String endDate, int limit,
                                        String category, String store, String country, String developer);

    /**
     * 获取筛选选项
     */
    Map<String, Object> getFilterOptions();

    /**
     * 获取广告表现
     */
    Map<String, Object> getAdPerformance(String startDate, String endDate, String category,
                                          String store, String country, String developer);

    /**
     * 清除缓存
     */
    Map<String, Object> clearCache();

    /**
     * 对比数据 - 获取本期和对比期的完整数据对比
     */
    Map<String, Object> getCompareData(String currentStartDate, String currentEndDate,
                                        String compareStartDate, String compareEndDate,
                                        String category, String store, String country, String developer);
}
