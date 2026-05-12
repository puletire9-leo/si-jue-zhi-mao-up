package com.sjzm.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * 备份服务
 * <p>
 * 对齐 Python backup_service.py：
 * 1. 创建备份
 * 2. 获取备份记录
 * 3. 删除备份
 * 4. 获取过期备份
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BackupService {

    private final JdbcTemplate jdbcTemplate;

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final int DEFAULT_EXPIRE_DAYS = 3;

    public Map<String, Object> createBackup(String backupType) {
        log.info("创建备份: type={}", backupType);

        Map<String, Object> result = new HashMap<>();

        try {
            String backupPath = generateBackupPath(backupType);
            String fileName = generateBackupFileName();
            LocalDateTime now = LocalDateTime.now();
            String status = "pending";

            String insertSql = """
                    INSERT INTO backup_records (file_name, file_path, file_size, storage_location, status, created_at, created_by)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """;

            jdbcTemplate.update(insertSql, fileName, backupPath, 0, backupType, status, now.format(DATE_FORMATTER), "system");

            Long backupId = jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Long.class);

            result.put("success", true);
            result.put("message", "备份创建成功");
            result.put("backupId", backupId);
            result.put("fileName", fileName);

            return result;
        } catch (Exception e) {
            log.error("创建备份失败", e);
            result.put("success", false);
            result.put("message", "创建备份失败: " + e.getMessage());
            return result;
        }
    }

    public Map<String, Object> getBackupRecords(int page, int limit, String storageLocation) {
        log.info("获取备份记录: page={}, limit={}, storageLocation={}", page, limit, storageLocation);

        Map<String, Object> result = new HashMap<>();

        try {
            String countSql = "SELECT COUNT(*) FROM backup_records";
            String querySql = """
                    SELECT id, file_name, file_path, file_size, storage_location, status, created_at, created_by, updated_at
                    FROM backup_records
                    """;

            List<Object> params = new ArrayList<>();

            if (storageLocation != null && !storageLocation.isEmpty()) {
                countSql += " WHERE storage_location = ?";
                querySql += " WHERE storage_location = ?";
                params.add(storageLocation);
            }

            querySql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";

            Long total = jdbcTemplate.queryForObject(countSql, Long.class, params.toArray());

            params.add(limit);
            params.add((page - 1) * limit);

            List<Map<String, Object>> records = jdbcTemplate.queryForList(querySql, params.toArray());

            result.put("success", true);
            result.put("data", records);
            result.put("total", total);
            result.put("page", page);
            result.put("limit", limit);

            return result;
        } catch (Exception e) {
            log.error("获取备份记录失败", e);
            result.put("success", false);
            result.put("message", "获取备份记录失败: " + e.getMessage());
            return result;
        }
    }

    public Map<String, Object> getBackupUrl(Long backupId) {
        log.info("获取备份URL: id={}", backupId);

        Map<String, Object> result = new HashMap<>();

        try {
            List<Map<String, Object>> records = jdbcTemplate.queryForList(
                    "SELECT file_name, file_path, storage_location FROM backup_records WHERE id = ?", backupId);

            if (records.isEmpty()) {
                result.put("success", false);
                result.put("message", "备份记录不存在");
                return result;
            }

            Map<String, Object> record = records.get(0);
            String filePath = (String) record.get("file_path");
            String fileName = (String) record.get("file_name");

            String downloadUrl = generateDownloadUrl(filePath, fileName, (String) record.get("storage_location"));

            result.put("success", true);
            Map<String, Object> data = new HashMap<>();
            data.put("backupId", backupId);
            data.put("fileName", fileName);
            data.put("downloadUrl", downloadUrl);
            result.put("data", data);

            return result;
        } catch (Exception e) {
            log.error("获取备份URL失败", e);
            result.put("success", false);
            result.put("message", "获取备份URL失败: " + e.getMessage());
            return result;
        }
    }

    public Map<String, Object> deleteBackup(Long backupId) {
        log.info("删除备份: id={}", backupId);

        Map<String, Object> result = new HashMap<>();

        try {
            List<Map<String, Object>> records = jdbcTemplate.queryForList(
                    "SELECT file_path FROM backup_records WHERE id = ?", backupId);

            if (records.isEmpty()) {
                result.put("success", false);
                result.put("message", "备份记录不存在");
                return result;
            }

            int deleted = jdbcTemplate.update("DELETE FROM backup_records WHERE id = ?", backupId);

            if (deleted > 0) {
                result.put("success", true);
                result.put("message", "备份删除成功");
            } else {
                result.put("success", false);
                result.put("message", "备份删除失败");
            }

            return result;
        } catch (Exception e) {
            log.error("删除备份失败", e);
            result.put("success", false);
            result.put("message", "删除备份失败: " + e.getMessage());
            return result;
        }
    }

    public Map<String, Object> getExpiredBackups() {
        log.info("获取过期备份");

        Map<String, Object> result = new HashMap<>();

        try {
            String sql = """
                    SELECT id, file_name, file_path, created_at
                    FROM backup_records
                    WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
                    ORDER BY created_at DESC
                    """;

            List<Map<String, Object>> records = jdbcTemplate.queryForList(sql, DEFAULT_EXPIRE_DAYS);

            result.put("success", true);
            result.put("data", records);
            result.put("count", records.size());

            return result;
        } catch (Exception e) {
            log.error("获取过期备份失败", e);
            result.put("success", false);
            result.put("message", "获取过期备份失败: " + e.getMessage());
            return result;
        }
    }

    public Map<String, Object> deleteExpiredBackups() {
        log.info("删除过期备份");

        Map<String, Object> result = new HashMap<>();

        try {
            String selectSql = """
                    SELECT id FROM backup_records
                    WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
                    """;

            List<Long> expiredIds = jdbcTemplate.queryForList(selectSql, Long.class, DEFAULT_EXPIRE_DAYS);

            if (expiredIds.isEmpty()) {
                result.put("success", true);
                result.put("message", "没有过期的备份");
                result.put("deleted", 0);
                return result;
            }

            String deleteSql = "DELETE FROM backup_records WHERE id = ?";
            int deleted = 0;
            for (Long id : expiredIds) {
                deleted += jdbcTemplate.update(deleteSql, id);
            }

            result.put("success", true);
            result.put("message", "过期备份删除成功");
            result.put("deleted", deleted);

            return result;
        } catch (Exception e) {
            log.error("删除过期备份失败", e);
            result.put("success", false);
            result.put("message", "删除过期备份失败: " + e.getMessage());
            return result;
        }
    }

    private String generateBackupPath(String backupType) {
        String basePath = "local".equals(backupType) ? "/backups/local/" : "/backups/cos/";
        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
        return basePath + "backup_" + timestamp + ".sql";
    }

    private String generateBackupFileName() {
        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
        return "backup_" + timestamp + ".sql";
    }

    private String generateDownloadUrl(String filePath, String fileName, String storageLocation) {
        if ("cos".equals(storageLocation)) {
            return "/api/v1/system-config/backup/download/" + filePath;
        }
        return "/api/v1/system-config/backup/download/" + fileName;
    }
}
