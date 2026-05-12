package com.sjzm.service;

import com.sjzm.common.PageResult;

import java.util.List;
import java.util.Map;

/**
 * 下载任务服务接口（对齐 Python 的 download_tasks）
 */
public interface DownloadTaskService {

    /**
     * 创建下载任务
     */
    Map<String, Object> createTask(String name, String source, List<String> skus, Long userId, String username);

    /**
     * 获取任务列表
     */
    PageResult<Map<String, Object>> getTasks(Long userId, String status, String source, String keyword, int page, int size);

    /**
     * 获取任务详情
     */
    Map<String, Object> getTask(Long id);

    /**
     * 更新任务状态
     */
    Map<String, Object> updateTaskStatus(Long id, String status, String filePath, String filename, Long fileSize);

    /**
     * 删除任务
     */
    boolean deleteTask(Long id);

    /**
     * 批量删除任务
     */
    Map<String, Object> batchDeleteTasks(List<Long> ids);

    /**
     * 重试失败任务
     */
    Map<String, Object> retryTask(Long id);

    /**
     * 清理过期任务
     */
    Map<String, Object> cleanupOldTasks(int days);
}
