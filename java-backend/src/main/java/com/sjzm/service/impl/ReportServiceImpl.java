package com.sjzm.service.impl;

import com.sjzm.common.BusinessException;
import com.sjzm.service.ReportService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.attribute.BasicFileAttributes;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.*;

/**
 * 报表服务实现（对齐 Python 的 reports）
 * 完整实现 Python 脚本调用、报告文件读取、异步执行等功能
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ReportServiceImpl implements ReportService {

    @Value("${app.reports.script-path:scripts/analysis/generate_liumiao_report_final.py}")
    private String reportScriptPath;

    @Value("${app.reports.dir:docs/reports}")
    private String reportsDir;

    @Value("${app.reports.timeout:600}")
    private int scriptTimeout;

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final DateTimeFormatter FILE_DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss");

    private final ExecutorService executorService = Executors.newCachedThreadPool();

    @Override
    public Map<String, Object> generateReports() {
        log.info("生成报告: scriptPath={}", reportScriptPath);

        Path scriptPath = Paths.get(reportScriptPath);

        if (!Files.exists(scriptPath)) {
            log.warn("报告生成脚本不存在: {}", reportScriptPath);
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("status", "error");
            result.put("message", "报告生成脚本不存在: " + reportScriptPath);
            result.put("script_path", reportScriptPath);
            return result;
        }

        executeReportScriptAsync();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("status", "started");
        result.put("message", "报告生成任务已启动，请稍候查看结果");
        result.put("timeout_seconds", scriptTimeout);
        result.put("script_path", reportScriptPath);

        return result;
    }

    @Async
    protected void executeReportScriptAsync() {
        log.info("开始执行报告生成脚本: {}", reportScriptPath);

        ProcessBuilder processBuilder = new ProcessBuilder("python", reportScriptPath);
        processBuilder.redirectErrorStream(true);
        processBuilder.environment().put("PYTHONIOENCODING", "utf-8");

        Process process = null;
        try {
            process = processBuilder.start();

            StringBuilder output = new StringBuilder();
            StringBuilder errorOutput = new StringBuilder();

            BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8));
            BufferedReader errorReader = new BufferedReader(
                    new InputStreamReader(process.getErrorStream(), StandardCharsets.UTF_8));

            final Process finalProcess = process;
            Future<Integer> processFuture = executorService.submit(() -> {
                try {
                    return Integer.valueOf(finalProcess.waitFor());
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    return Integer.valueOf(-1);
                }
            });

            while (true) {
                try {
                    Integer exitCode = processFuture.get(1, TimeUnit.SECONDS);
                    if (exitCode != null) {
                        break;
                    }
                } catch (TimeoutException e) {
                } catch (ExecutionException e) {
                    break;
                }

                String line;
                while ((line = reader.readLine()) != null) {
                    output.append(line).append("\n");
                    log.debug("脚本输出: {}", line);
                }
            }

            reader.close();

            int exitCode = process.exitValue();

            log.info("报告生成脚本执行完成: exitCode={}", exitCode);
            log.debug("脚本输出:\n{}", output);

            if (exitCode != 0) {
                log.warn("脚本执行异常: exitCode={}", exitCode);
            }

        } catch (IOException e) {
            log.error("执行报告生成脚本失败: {}", e.getMessage(), e);
        } catch (Exception e) {
            log.error("报告生成过程异常: {}", e.getMessage(), e);
        } finally {
            if (process != null && process.isAlive()) {
                process.destroyForcibly();
            }
        }
    }

    @Override
    public Map<String, Object> getReport(String developer) {
        log.info("获取报告: developer={}", developer);

        String fileName;
        if ("total".equals(developer)) {
            fileName = "思觉智贸总结_总.md";
        } else {
            fileName = "思觉智贸总结_" + developer + ".md";
        }

        Path reportPath = Paths.get(reportsDir, fileName);

        if (!Files.exists(reportPath)) {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("status", "error");
            result.put("message", "报告文件不存在: " + fileName);
            result.put("developer", developer);
            result.put("file_name", fileName);
            return result;
        }

        try {
            String content = Files.readString(reportPath, StandardCharsets.UTF_8);

            BasicFileAttributes attrs = Files.readAttributes(reportPath, BasicFileAttributes.class);
            LocalDateTime modifiedTime = Instant.ofEpochMilli(attrs.lastModifiedTime().toMillis())
                    .atZone(ZoneId.systemDefault())
                    .toLocalDateTime();

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("status", "success");
            result.put("content", content);
            result.put("developer", developer);
            result.put("file_name", fileName);
            result.put("file_size", attrs.size());
            result.put("modified_at", modifiedTime.format(DATE_FORMATTER));

            return result;

        } catch (IOException e) {
            log.error("读取报告文件失败: {}", e.getMessage(), e);
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("status", "error");
            result.put("message", "读取报告失败: " + e.getMessage());
            result.put("developer", developer);
            result.put("file_name", fileName);
            return result;
        }
    }

    @Override
    public Map<String, Object> listReportFiles() {
        log.info("获取报告文件列表: reportsDir={}", reportsDir);

        Path reportsPath = Paths.get(reportsDir);

        if (!Files.exists(reportsPath)) {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("status", "success");
            result.put("files", Collections.emptyList());
            result.put("total", 0);
            result.put("message", "报告目录不存在: " + reportsDir);
            return result;
        }

        List<Map<String, Object>> files = new ArrayList<>();

        try {
            Files.list(reportsPath)
                    .filter(path -> path.toString().endsWith(".md"))
                    .sorted((a, b) -> {
                        try {
                            BasicFileAttributes attrsA = Files.readAttributes(a, BasicFileAttributes.class);
                            BasicFileAttributes attrsB = Files.readAttributes(b, BasicFileAttributes.class);
                            return Long.compare(attrsB.lastModifiedTime().toMillis(), attrsA.lastModifiedTime().toMillis());
                        } catch (IOException e) {
                            return 0;
                        }
                    })
                    .forEach(path -> {
                        try {
                            BasicFileAttributes attrs = Files.readAttributes(path, BasicFileAttributes.class);
                            LocalDateTime modifiedTime = Instant.ofEpochMilli(attrs.lastModifiedTime().toMillis())
                                    .atZone(ZoneId.systemDefault())
                                    .toLocalDateTime();

                            Map<String, Object> fileInfo = new LinkedHashMap<>();
                            fileInfo.put("name", path.getFileName().toString());
                            fileInfo.put("size", attrs.size());
                            fileInfo.put("size_formatted", formatFileSize(attrs.size()));
                            fileInfo.put("modified", modifiedTime.format(DATE_FORMATTER));
                            fileInfo.put("modified_timestamp", attrs.lastModifiedTime().toMillis());

                            files.add(fileInfo);
                        } catch (IOException e) {
                            log.warn("读取文件属性失败: {}", path, e);
                        }
                    });

        } catch (IOException e) {
            log.error("列出报告文件失败: {}", e.getMessage(), e);
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("status", "error");
            result.put("message", "列出报告文件失败: " + e.getMessage());
            return result;
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("status", "success");
        result.put("files", files);
        result.put("total", files.size());
        result.put("reports_dir", reportsDir);

        return result;
    }

    private String formatFileSize(long size) {
        if (size < 1024) {
            return size + " B";
        } else if (size < 1024 * 1024) {
            return String.format("%.2f KB", size / 1024.0);
        } else if (size < 1024 * 1024 * 1024) {
            return String.format("%.2f MB", size / 1024.0 / 1024.0);
        } else {
            return String.format("%.2f GB", size / 1024.0 / 1024.0 / 1024.0);
        }
    }
}
