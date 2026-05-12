package com.sjzm.controller;

import com.sjzm.common.BusinessException;
import com.sjzm.common.Result;
import com.sjzm.service.ReportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 报表控制器（对齐 Python 的 /reports）
 */
@Slf4j
@Tag(name = "报表管理", description = "报告生成、查看、列表")
@RestController
@RequestMapping("/api/v1/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;

    @Operation(summary = "生成报告", description = "异步执行报告生成脚本")
    @PostMapping("/generate")
    public Result<Map<String, Object>> generateReports() {
        try {
            Map<String, Object> result = reportService.generateReports();
            return Result.success(result);
        } catch (Exception e) {
            throw new BusinessException("生成报告失败: " + e.getMessage());
        }
    }

    @Operation(summary = "获取报告", description = "获取指定开发人员的报告内容")
    @GetMapping("/{developer}")
    public Result<Map<String, Object>> getReport(@PathVariable String developer) {
        try {
            Map<String, Object> result = reportService.getReport(developer);
            if (result.containsKey("status") && "error".equals(result.get("status"))) {
                return Result.error(result.get("message").toString());
            }
            return Result.success(result);
        } catch (Exception e) {
            throw new BusinessException("获取报告失败: " + e.getMessage());
        }
    }

    @Operation(summary = "获取报告文件列表", description = "获取所有报告文件列表")
    @GetMapping("/list/files")
    public Result<Map<String, Object>> listReportFiles() {
        try {
            Map<String, Object> result = reportService.listReportFiles();
            return Result.success(result);
        } catch (Exception e) {
            throw new BusinessException("获取报告文件列表失败: " + e.getMessage());
        }
    }
}
