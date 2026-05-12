package com.sjzm.service;

import java.util.Map;

/**
 * 导出服务接口（对齐 Python 的 export）
 */
public interface ExportService {

    /**
     * 导出产品数据
     */
    Map<String, Object> exportProducts(int page, int size, String format);

    /**
     * 导出图片数据
     */
    Map<String, Object> exportImages(int page, int size, String format);

    /**
     * 导出统计数据
     */
    Map<String, Object> exportStatistics();
}
