package com.sjzm.controller;

import com.sjzm.common.BusinessException;
import com.sjzm.common.Result;
import com.sjzm.service.HealthCheckService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 健康检查控制器（对齐 Python 的 /health）
 */
@Slf4j
@Tag(name = "健康检查", description = "服务健康状态检查、数据库连接检查、系统资源监控")
@RestController
@RequestMapping("/api/v1/health")
@RequiredArgsConstructor
public class HealthController {

    private final HealthCheckService healthCheckService;

    @Operation(summary = "基础健康检查", description = "检查服务基本运行状态和数据库连接")
    @GetMapping
    public Result<Map<String, Object>> health() {
        try {
            Map<String, Object> health = healthCheckService.basicHealthCheck();
            return Result.success(health);
        } catch (Exception e) {
            log.error("健康检查失败", e);
            throw new BusinessException("健康检查失败: " + e.getMessage());
        }
    }

    @Operation(summary = "详细健康检查", description = "检查服务运行状态、数据库连接池、表信息、系统资源使用情况")
    @GetMapping("/detailed")
    public Result<Map<String, Object>> detailedHealth(
            @Parameter(description = "是否检查数据库") @RequestParam(defaultValue = "true") boolean checkDatabase,
            @Parameter(description = "是否检查系统资源") @RequestParam(defaultValue = "true") boolean checkSystem,
            @Parameter(description = "是否检查表统计") @RequestParam(defaultValue = "false") boolean checkTables) {
        try {
            Map<String, Object> health = healthCheckService.detailedHealthCheck();
            return Result.success(health);
        } catch (Exception e) {
            log.error("详细健康检查失败", e);
            throw new BusinessException("详细健康检查失败: " + e.getMessage());
        }
    }
}
