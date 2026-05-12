package com.sjzm.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * 系统日志服务
 * <p>
 * 对齐 Python system_log_service.py：
 * 1. 系统文档CRUD
 * 2. 更新记录CRUD
 * 3. 需求清单CRUD
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SystemLogService {

    private final JdbcTemplate jdbcTemplate;

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    // ==================== 系统文档 ====================

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> createSystemDoc(Map<String, Object> docData) {
        log.info("创建系统文档: {}", docData);

        String title = (String) docData.get("title");
        String content = (String) docData.getOrDefault("content", "");
        String docType = (String) docData.getOrDefault("docType", "general");

        if (title == null || title.isEmpty()) {
            throw new RuntimeException("文档标题不能为空");
        }

        try {
            String sql = """
                    INSERT INTO system_docs (title, content, doc_type, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?)
                    """;

            LocalDateTime now = LocalDateTime.now();
            jdbcTemplate.update(sql, title, content, docType, now.format(DATE_FORMATTER), now.format(DATE_FORMATTER));

            Long id = jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Long.class);

            Map<String, Object> result = new HashMap<>();
            result.put("id", id);
            result.put("title", title);
            result.put("content", content);
            result.put("docType", docType);

            return result;
        } catch (Exception e) {
            log.error("创建系统文档失败", e);
            throw new RuntimeException("创建系统文档失败: " + e.getMessage());
        }
    }

    public Map<String, Object> getSystemDocs(int page, int limit, String docType, String keyword) {
        log.info("获取系统文档列表: page={}, limit={}, docType={}", page, limit, docType);

        Map<String, Object> result = new HashMap<>();

        try {
            StringBuilder countSql = new StringBuilder("SELECT COUNT(*) FROM system_docs WHERE 1=1");
            StringBuilder querySql = new StringBuilder("""
                    SELECT id, title, content, doc_type, created_at, updated_at
                    FROM system_docs WHERE 1=1
                    """);
            List<Object> params = new ArrayList<>();

            if (docType != null && !docType.isEmpty()) {
                countSql.append(" AND doc_type = ?");
                querySql.append(" AND doc_type = ?");
                params.add(docType);
            }

            if (keyword != null && !keyword.isEmpty()) {
                countSql.append(" AND (title LIKE ? OR content LIKE ?)");
                querySql.append(" AND (title LIKE ? OR content LIKE ?)");
                String likeKeyword = "%" + keyword + "%";
                params.add(likeKeyword);
                params.add(likeKeyword);
            }

            querySql.append(" ORDER BY updated_at DESC LIMIT ? OFFSET ?");

            Long total = jdbcTemplate.queryForObject(countSql.toString(), Long.class, params.toArray());

            params.add(limit);
            params.add((page - 1) * limit);

            List<Map<String, Object>> records = jdbcTemplate.queryForList(querySql.toString(), params.toArray());

            result.put("records", records);
            result.put("total", total);
            result.put("page", page);
            result.put("limit", limit);

            return result;
        } catch (Exception e) {
            log.error("获取系统文档列表失败", e);
            throw new RuntimeException("获取系统文档列表失败: " + e.getMessage());
        }
    }

    public Map<String, Object> getSystemDoc(Long docId) {
        log.info("获取系统文档详情: id={}", docId);

        try {
            List<Map<String, Object>> records = jdbcTemplate.queryForList(
                    "SELECT * FROM system_docs WHERE id = ?", docId);

            if (records.isEmpty()) {
                throw new RuntimeException("系统文档不存在: " + docId);
            }

            return records.get(0);
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            log.error("获取系统文档详情失败", e);
            throw new RuntimeException("获取系统文档详情失败: " + e.getMessage());
        }
    }

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> updateSystemDoc(Long docId, Map<String, Object> updateData) {
        log.info("更新系统文档: id={}", docId);

        try {
            List<Map<String, Object>> existing = jdbcTemplate.queryForList(
                    "SELECT id FROM system_docs WHERE id = ?", docId);
            if (existing.isEmpty()) {
                throw new RuntimeException("系统文档不存在: " + docId);
            }

            List<String> setClauses = new ArrayList<>();
            List<Object> params = new ArrayList<>();

            if (updateData.containsKey("title")) {
                String title = (String) updateData.get("title");
                if (title != null && !title.isEmpty()) {
                    setClauses.add("title = ?");
                    params.add(title);
                }
            }

            if (updateData.containsKey("content")) {
                setClauses.add("content = ?");
                params.add(updateData.get("content"));
            }

            if (updateData.containsKey("docType")) {
                setClauses.add("doc_type = ?");
                params.add(updateData.get("docType"));
            }

            if (setClauses.isEmpty()) {
                throw new RuntimeException("没有需要更新的字段");
            }

            setClauses.add("updated_at = ?");
            params.add(LocalDateTime.now().format(DATE_FORMATTER));
            params.add(docId);

            String sql = "UPDATE system_docs SET " + String.join(", ", setClauses) + " WHERE id = ?";
            jdbcTemplate.update(sql, params.toArray());

            return getSystemDoc(docId);
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            log.error("更新系统文档失败", e);
            throw new RuntimeException("更新系统文档失败: " + e.getMessage());
        }
    }

    @Transactional(rollbackFor = Exception.class)
    public boolean deleteSystemDoc(Long docId) {
        log.info("删除系统文档: id={}", docId);

        try {
            int deleted = jdbcTemplate.update("DELETE FROM system_docs WHERE id = ?", docId);
            return deleted > 0;
        } catch (Exception e) {
            log.error("删除系统文档失败", e);
            throw new RuntimeException("删除系统文档失败: " + e.getMessage());
        }
    }

    // ==================== 更新记录 ====================

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> createUpdateRecord(Map<String, Object> recordData) {
        log.info("创建更新记录: {}", recordData);

        String title = (String) recordData.get("title");
        String content = (String) recordData.getOrDefault("content", "");
        String updateType = (String) recordData.getOrDefault("updateType", "feature");

        if (title == null || title.isEmpty()) {
            throw new RuntimeException("更新标题不能为空");
        }

        try {
            String sql = """
                    INSERT INTO update_records (title, content, update_type, created_at)
                    VALUES (?, ?, ?, ?)
                    """;

            LocalDateTime now = LocalDateTime.now();
            jdbcTemplate.update(sql, title, content, updateType, now.format(DATE_FORMATTER));

            Long id = jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Long.class);

            Map<String, Object> result = new HashMap<>();
            result.put("id", id);
            result.put("title", title);
            result.put("content", content);
            result.put("updateType", updateType);

            return result;
        } catch (Exception e) {
            log.error("创建更新记录失败", e);
            throw new RuntimeException("创建更新记录失败: " + e.getMessage());
        }
    }

    public Map<String, Object> getUpdateRecords(int page, int limit) {
        log.info("获取更新记录列表: page={}, limit={}", page, limit);

        Map<String, Object> result = new HashMap<>();

        try {
            String countSql = "SELECT COUNT(*) FROM update_records";
            String querySql = """
                    SELECT id, title, content, update_type, created_at
                    FROM update_records
                    ORDER BY created_at DESC
                    LIMIT ? OFFSET ?
                    """;

            Long total = jdbcTemplate.queryForObject(countSql, Long.class);

            List<Map<String, Object>> records = jdbcTemplate.queryForList(querySql, limit, (page - 1) * limit);

            result.put("records", records);
            result.put("total", total);
            result.put("page", page);
            result.put("limit", limit);

            return result;
        } catch (Exception e) {
            log.error("获取更新记录列表失败", e);
            throw new RuntimeException("获取更新记录列表失败: " + e.getMessage());
        }
    }

    // ==================== 需求清单 ====================

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> createRequirement(Map<String, Object> reqData) {
        log.info("创建需求: {}", reqData);

        String title = (String) reqData.get("title");
        String description = (String) reqData.getOrDefault("description", "");
        String priority = (String) reqData.getOrDefault("priority", "medium");
        String status = (String) reqData.getOrDefault("status", "pending");

        if (title == null || title.isEmpty()) {
            throw new RuntimeException("需求标题不能为空");
        }

        try {
            String sql = """
                    INSERT INTO requirements (title, description, priority, status, created_at)
                    VALUES (?, ?, ?, ?, ?)
                    """;

            LocalDateTime now = LocalDateTime.now();
            jdbcTemplate.update(sql, title, description, priority, status, now.format(DATE_FORMATTER));

            Long id = jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Long.class);

            Map<String, Object> result = new HashMap<>();
            result.put("id", id);
            result.put("title", title);
            result.put("description", description);
            result.put("priority", priority);
            result.put("status", status);

            return result;
        } catch (Exception e) {
            log.error("创建需求失败", e);
            throw new RuntimeException("创建需求失败: " + e.getMessage());
        }
    }

    public Map<String, Object> getRequirements(int page, int limit, String status, String priority) {
        log.info("获取需求列表: page={}, limit={}, status={}", page, limit, status);

        Map<String, Object> result = new HashMap<>();

        try {
            StringBuilder countSql = new StringBuilder("SELECT COUNT(*) FROM requirements WHERE 1=1");
            StringBuilder querySql = new StringBuilder("""
                    SELECT id, title, description, priority, status, created_at
                    FROM requirements WHERE 1=1
                    """);
            List<Object> params = new ArrayList<>();

            if (status != null && !status.isEmpty()) {
                countSql.append(" AND status = ?");
                querySql.append(" AND status = ?");
                params.add(status);
            }

            if (priority != null && !priority.isEmpty()) {
                countSql.append(" AND priority = ?");
                querySql.append(" AND priority = ?");
                params.add(priority);
            }

            querySql.append(" ORDER BY created_at DESC LIMIT ? OFFSET ?");

            Long total = jdbcTemplate.queryForObject(countSql.toString(), Long.class, params.toArray());

            params.add(limit);
            params.add((page - 1) * limit);

            List<Map<String, Object>> records = jdbcTemplate.queryForList(querySql.toString(), params.toArray());

            result.put("records", records);
            result.put("total", total);
            result.put("page", page);
            result.put("limit", limit);

            return result;
        } catch (Exception e) {
            log.error("获取需求列表失败", e);
            throw new RuntimeException("获取需求列表失败: " + e.getMessage());
        }
    }

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> updateRequirementStatus(Long reqId, String status) {
        log.info("更新需求状态: id={}, status={}", reqId, status);

        try {
            int updated = jdbcTemplate.update(
                    "UPDATE requirements SET status = ? WHERE id = ?", status, reqId);

            if (updated == 0) {
                throw new RuntimeException("需求不存在: " + reqId);
            }

            Map<String, Object> result = new HashMap<>();
            result.put("id", reqId);
            result.put("status", status);
            result.put("message", "状态更新成功");

            return result;
        } catch (Exception e) {
            log.error("更新需求状态失败", e);
            throw new RuntimeException("更新需求状态失败: " + e.getMessage());
        }
    }
}
