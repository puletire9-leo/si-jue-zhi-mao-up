package com.sjzm.service;

import java.util.List;
import java.util.Map;

/**
 * 报表服务接口（对齐 Python 的 reports）
 */
public interface ReportService {

    /**
     * 生成报告
     */
    Map<String, Object> generateReports();

    /**
     * 获取报告内容
     */
    Map<String, Object> getReport(String developer);

    /**
     * 获取报告文件列表
     */
    Map<String, Object> listReportFiles();
}
