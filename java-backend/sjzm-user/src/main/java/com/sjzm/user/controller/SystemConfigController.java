package com.sjzm.user.controller;

import com.sjzm.common.Result;
import com.sjzm.user.entity.SystemConfig;
import com.sjzm.user.service.SystemConfigService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * RDS 操作中心 - 系统配置/凭证查询接口。
 *
 * <p>凭证表含明文密码，全部方法限 admin：SecurityConfig 已开 @EnableMethodSecurity，
 * JwtAuthenticationFilter 把 role 映射为 ROLE_ + role.toUpperCase()，故 admin → ROLE_ADMIN。
 */
@RestController
@RequestMapping("/api/v1/system-config")
@RequiredArgsConstructor
@Tag(name = "系统配置(凭证总账)", description = "RDS/飞书/代理等凭证集中查询，仅 admin")
@PreAuthorize("hasRole('ADMIN')")
public class SystemConfigController {

    private final SystemConfigService systemConfigService;

    @GetMapping({"", "/"})
    @Operation(summary = "全部配置")
    public Result<List<SystemConfig>> listAll() {
        return Result.success(systemConfigService.listAll());
    }

    @GetMapping("/by-category")
    @Operation(summary = "按分类查询(rds/feishu/proxy/system)")
    public Result<List<SystemConfig>> listByCategory(@RequestParam String category) {
        return Result.success(systemConfigService.listByCategory(category));
    }

    @GetMapping("/by-key")
    @Operation(summary = "按键查询单条")
    public Result<SystemConfig> getByKey(@RequestParam String key) {
        SystemConfig config = systemConfigService.getByKey(key);
        if (config == null) {
            return Result.error(404, "配置不存在: " + key);
        }
        return Result.success(config);
    }
}
