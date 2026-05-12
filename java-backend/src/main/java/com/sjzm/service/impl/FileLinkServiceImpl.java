package com.sjzm.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.sjzm.common.BusinessException;
import com.sjzm.common.PageResult;
import com.sjzm.entity.FileLink;
import com.sjzm.mapper.FileLinkMapper;
import com.sjzm.service.FileLinkService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.net.HttpURLConnection;
import java.net.URL;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 文件链接服务实现（对齐 Python 的 file_links）
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FileLinkServiceImpl implements FileLinkService {

    private final FileLinkMapper fileLinkMapper;

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> createFileLink(Map<String, Object> data) {
        log.info("创建文件链接: {}", data);

        String url = (String) data.get("url");
        String title = (String) data.get("title");
        String linkType = (String) data.get("link_type");
        String libraryType = (String) data.get("library_type");

        if (!StringUtils.hasText(url)) {
            throw new BusinessException(400, "URL不能为空");
        }
        if (!StringUtils.hasText(title)) {
            throw new BusinessException(400, "标题不能为空");
        }

        FileLink fileLink = new FileLink();
        fileLink.setLinkUrl(url);
        fileLink.setObjectKey((String) data.get("object_key"));
        fileLink.setFileType(linkType != null ? linkType : "standard_url");
        fileLink.setOriginalFilename((String) data.get("original_filename"));
        fileLink.setEntityType(libraryType != null ? libraryType : (String) data.get("entity_type"));
        fileLink.setClickCount(0);
        fileLink.setStatus("active");

        Object expiresAt = data.get("expires_at");
        if (expiresAt != null) {
            fileLink.setExpiresAt(LocalDateTime.parse(expiresAt.toString(), DATE_FORMATTER));
        }

        fileLinkMapper.insert(fileLink);
        return convertToMap(fileLink);
    }

    @Override
    public PageResult<Map<String, Object>> getFileLinks(String libraryType, int page, int size,
                                                        String keyword, String category, String linkType, String status) {
        log.info("获取文件链接列表: libraryType={}, page={}, size={}, keyword={}, category={}, linkType={}, status={}",
                libraryType, page, size, keyword, category, linkType, status);

        if (page < 1) page = 1;
        if (size < 1) size = 12;
        if (size > 100) size = 100;

        Page<FileLink> pageParam = new Page<>(page, size);
        LambdaQueryWrapper<FileLink> wrapper = new LambdaQueryWrapper<>();

        if (StringUtils.hasText(libraryType)) {
            wrapper.eq(FileLink::getEntityType, libraryType);
        }

        if (StringUtils.hasText(keyword)) {
            wrapper.and(w -> w.like(FileLink::getLinkUrl, keyword)
                    .or()
                    .like(FileLink::getOriginalFilename, keyword));
        }

        if (StringUtils.hasText(category)) {
            wrapper.eq(FileLink::getFileType, category);
        }

        if (StringUtils.hasText(linkType)) {
            wrapper.eq(FileLink::getFileType, linkType);
        }

        if (StringUtils.hasText(status)) {
            wrapper.eq(FileLink::getStatus, status);
        }

        wrapper.orderByDesc(FileLink::getCreatedAt);
        Page<FileLink> linkPage = fileLinkMapper.selectPage(pageParam, wrapper);

        List<Map<String, Object>> records = linkPage.getRecords().stream()
                .map(this::convertToMap)
                .collect(Collectors.toList());

        return PageResult.of(records, linkPage.getTotal(), (long) page, (long) size);
    }

    @Override
    public Map<String, Object> getFileLink(Long id) {
        log.info("获取文件链接: id={}", id);

        FileLink fileLink = fileLinkMapper.selectById(id);
        if (fileLink == null) {
            throw new BusinessException(404, "文件链接不存在");
        }
        return convertToMap(fileLink);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> updateFileLink(Long id, Map<String, Object> data) {
        log.info("更新文件链接: id={}", id);

        FileLink fileLink = fileLinkMapper.selectById(id);
        if (fileLink == null) {
            throw new BusinessException(404, "文件链接不存在");
        }

        if (data.containsKey("title")) {
            // title 存储在 link_url 中（简化处理）
        }

        if (data.containsKey("url")) {
            fileLink.setLinkUrl((String) data.get("url"));
        }

        if (data.containsKey("link_type")) {
            fileLink.setFileType((String) data.get("link_type"));
        }

        if (data.containsKey("category")) {
            fileLink.setFileType((String) data.get("category"));
        }

        if (data.containsKey("status")) {
            fileLink.setStatus((String) data.get("status"));
        }

        fileLinkMapper.updateById(fileLink);
        return convertToMap(fileLink);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean deleteFileLink(Long id) {
        log.info("删除文件链接: id={}", id);

        FileLink fileLink = fileLinkMapper.selectById(id);
        if (fileLink == null) {
            throw new BusinessException(404, "文件链接不存在");
        }

        fileLinkMapper.deleteById(id);
        return true;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> batchDeleteFileLinks(List<Long> ids) {
        log.info("批量删除文件链接: ids={}", ids);

        int deleted = 0;
        List<String> errors = new ArrayList<>();

        for (Long id : ids) {
            try {
                fileLinkMapper.deleteById(id);
                deleted++;
            } catch (Exception e) {
                errors.add("ID " + id + ": " + e.getMessage());
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("deleted_count", deleted);
        result.put("errors", errors);
        return result;
    }

    @Override
    public Map<String, Object> checkLinkStatus(Long id) {
        log.info("检查链接状态: id={}", id);

        FileLink fileLink = fileLinkMapper.selectById(id);
        if (fileLink == null) {
            throw new BusinessException(404, "文件链接不存在");
        }

        String url = fileLink.getLinkUrl();
        boolean isValid = false;
        String status = "unknown";
        int statusCode = 0;

        try {
            URL checkUrl = new URL(url);
            HttpURLConnection conn = (HttpURLConnection) checkUrl.openConnection();
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(5000);
            conn.setRequestMethod("HEAD");
            statusCode = conn.getResponseCode();
            conn.disconnect();

            isValid = statusCode >= 200 && statusCode < 400;
            status = isValid ? "valid" : "invalid";

        } catch (Exception e) {
            status = "error";
            log.warn("检查链接失败: id={}, error={}", id, e.getMessage());
        }

        Map<String, Object> result = new HashMap<>();
        result.put("id", fileLink.getId());
        result.put("url", url);
        result.put("status", status);
        result.put("status_code", statusCode);
        result.put("is_valid", isValid);
        return result;
    }

    @Override
    public List<String> getCategories(String libraryType) {
        log.info("获取分类列表: libraryType={}", libraryType);

        LambdaQueryWrapper<FileLink> wrapper = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(libraryType)) {
            wrapper.eq(FileLink::getEntityType, libraryType);
        }
        wrapper.select(FileLink::getFileType)
                .isNotNull(FileLink::getFileType)
                .ne(FileLink::getFileType, "")
                .groupBy(FileLink::getFileType);

        return fileLinkMapper.selectList(wrapper).stream()
                .map(FileLink::getFileType)
                .filter(StringUtils::hasText)
                .distinct()
                .collect(Collectors.toList());
    }

    @Override
    public Map<String, Object> getUploadStats() {
        log.info("获取上传统计");

        Map<String, Object> result = new HashMap<>();
        result.put("total_count", fileLinkMapper.selectCount(null));
        result.put("active_count", fileLinkMapper.selectCount(
                new LambdaQueryWrapper<FileLink>().eq(FileLink::getStatus, "active")));
        result.put("expired_count", fileLinkMapper.selectCount(
                new LambdaQueryWrapper<FileLink>().eq(FileLink::getStatus, "expired")));
        return result;
    }

    private Map<String, Object> convertToMap(FileLink fileLink) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", fileLink.getId());
        map.put("title", fileLink.getOriginalFilename());
        map.put("url", fileLink.getLinkUrl());
        map.put("object_key", fileLink.getObjectKey());
        map.put("link_type", fileLink.getFileType());
        map.put("original_filename", fileLink.getOriginalFilename());
        map.put("file_size", fileLink.getFileSize());
        map.put("library_type", fileLink.getEntityType());
        map.put("entity_id", fileLink.getEntityId());
        map.put("click_count", fileLink.getClickCount());
        map.put("expires_at", fileLink.getExpiresAt() != null ?
                fileLink.getExpiresAt().format(DATE_FORMATTER) : null);
        map.put("status", fileLink.getStatus());
        map.put("created_at", fileLink.getCreatedAt() != null ?
                fileLink.getCreatedAt().format(DATE_FORMATTER) : null);
        map.put("updated_at", fileLink.getUpdatedAt() != null ?
                fileLink.getUpdatedAt().format(DATE_FORMATTER) : null);
        return map;
    }
}
