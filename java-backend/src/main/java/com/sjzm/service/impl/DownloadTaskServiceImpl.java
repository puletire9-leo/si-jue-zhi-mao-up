package com.sjzm.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.sjzm.common.BusinessException;
import com.sjzm.common.PageResult;
import com.sjzm.entity.DownloadTask;
import com.sjzm.mapper.DownloadTaskMapper;
import com.sjzm.service.DownloadTaskService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 下载任务服务实现（对齐 Python 的 download_tasks）
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DownloadTaskServiceImpl implements DownloadTaskService {

    private final DownloadTaskMapper downloadTaskMapper;

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> createTask(String name, String source, List<String> skus, Long userId, String username) {
        log.info("创建下载任务: name={}, source={}, skus={}, userId={}", name, source, skus, userId);

        DownloadTask task = new DownloadTask();
        task.setName(name);
        task.setSource(source);
        task.setSkus(skus != null ? String.join(",", skus) : "");
        task.setStatus("pending");
        task.setProgress(0);
        task.setUserId(userId);
        task.setUsername(username);
        task.setCreatedAt(LocalDateTime.now());
        task.setUpdatedAt(LocalDateTime.now());

        downloadTaskMapper.insert(task);

        Map<String, Object> result = new HashMap<>();
        result.put("task_id", task.getId());
        result.put("message", "下载任务已创建");
        return result;
    }

    @Override
    public PageResult<Map<String, Object>> getTasks(Long userId, String status, String source, String keyword, int page, int size) {
        log.info("获取任务列表: userId={}, status={}, source={}, page={}, size={}", userId, status, source, page, size);

        if (page < 1) page = 1;
        if (size < 1) size = 20;
        if (size > 100) size = 100;

        Page<DownloadTask> pageParam = new Page<>(page, size);
        LambdaQueryWrapper<DownloadTask> wrapper = new LambdaQueryWrapper<>();

        if (userId != null) {
            wrapper.eq(DownloadTask::getUserId, userId);
        }

        if (StringUtils.hasText(status)) {
            wrapper.eq(DownloadTask::getStatus, status);
        }

        if (StringUtils.hasText(source)) {
            wrapper.eq(DownloadTask::getSource, source);
        }

        if (StringUtils.hasText(keyword)) {
            wrapper.like(DownloadTask::getName, keyword);
        }

        wrapper.orderByDesc(DownloadTask::getCreatedAt);
        Page<DownloadTask> taskPage = downloadTaskMapper.selectPage(pageParam, wrapper);

        List<Map<String, Object>> records = taskPage.getRecords().stream()
                .map(this::convertToMap)
                .collect(Collectors.toList());

        return PageResult.of(records, taskPage.getTotal(), (long) page, (long) size);
    }

    @Override
    public Map<String, Object> getTask(Long id) {
        log.info("获取任务详情: id={}", id);

        DownloadTask task = downloadTaskMapper.selectById(id);
        if (task == null) {
            throw new BusinessException(404, "任务不存在");
        }
        return convertToMap(task);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> updateTaskStatus(Long id, String status, String filePath, String filename, Long fileSize) {
        log.info("更新任务状态: id={}, status={}", id, status);

        DownloadTask task = downloadTaskMapper.selectById(id);
        if (task == null) {
            throw new BusinessException(404, "任务不存在");
        }

        if (StringUtils.hasText(status)) {
            task.setStatus(status);
        }

        if (StringUtils.hasText(filePath)) {
            task.setFilePath(filePath);
        }

        if (StringUtils.hasText(filename)) {
            task.setFilename(filename);
        }

        if (fileSize != null) {
            task.setFileSize(fileSize);
        }

        if ("completed".equals(status)) {
            task.setProgress(100);
        }

        task.setUpdatedAt(LocalDateTime.now());
        downloadTaskMapper.updateById(task);

        return convertToMap(task);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean deleteTask(Long id) {
        log.info("删除任务: id={}", id);

        DownloadTask task = downloadTaskMapper.selectById(id);
        if (task == null) {
            throw new BusinessException(404, "任务不存在");
        }

        downloadTaskMapper.deleteById(id);
        return true;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> batchDeleteTasks(List<Long> ids) {
        log.info("批量删除任务: ids={}", ids);

        int deleted = 0;
        List<String> errors = new ArrayList<>();

        for (Long id : ids) {
            try {
                downloadTaskMapper.deleteById(id);
                deleted++;
            } catch (Exception e) {
                errors.add("ID " + id + ": " + e.getMessage());
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("deleted", deleted);
        result.put("errors", errors);
        return result;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> retryTask(Long id) {
        log.info("重试任务: id={}", id);

        DownloadTask task = downloadTaskMapper.selectById(id);
        if (task == null) {
            throw new BusinessException(404, "任务不存在");
        }

        if (!"failed".equals(task.getStatus())) {
            throw new BusinessException(400, "只能重试失败的任务");
        }

        task.setStatus("pending");
        task.setErrorMessage(null);
        task.setProgress(0);
        task.setUpdatedAt(LocalDateTime.now());
        downloadTaskMapper.updateById(task);

        Map<String, Object> result = new HashMap<>();
        result.put("message", "任务已重新加入队列");
        return result;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> cleanupOldTasks(int days) {
        log.info("清理过期任务: days={}", days);

        LocalDateTime cutoff = LocalDateTime.now().minusDays(days);

        LambdaQueryWrapper<DownloadTask> wrapper = new LambdaQueryWrapper<>();
        wrapper.lt(DownloadTask::getCreatedAt, cutoff);

        int deleted = downloadTaskMapper.delete(wrapper);

        Map<String, Object> result = new HashMap<>();
        result.put("deleted", deleted);
        result.put("message", "已清理 " + deleted + " 个过期任务");
        return result;
    }

    private Map<String, Object> convertToMap(DownloadTask task) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", task.getId());
        map.put("name", task.getName());
        map.put("source", task.getSource());
        map.put("skus", task.getSkus() != null ? Arrays.asList(task.getSkus().split(",")) : Collections.emptyList());
        map.put("status", task.getStatus());
        map.put("file_path", task.getFilePath());
        map.put("filename", task.getFilename());
        map.put("file_size", task.getFileSize());
        map.put("progress", task.getProgress());
        map.put("error_message", task.getErrorMessage());
        map.put("user_id", task.getUserId());
        map.put("username", task.getUsername());
        map.put("created_at", task.getCreatedAt() != null ? task.getCreatedAt().format(DATE_FORMATTER) : null);
        map.put("updated_at", task.getUpdatedAt() != null ? task.getUpdatedAt().format(DATE_FORMATTER) : null);
        return map;
    }
}
