package com.sjzm.product.modules.feishu.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.sjzm.common.Result;
import com.sjzm.product.modules.feishu.service.FeishuClient;
import com.sjzm.product.modules.feishu.service.FeishuConfigService;
import com.sjzm.product.modules.automation.config.FinanceDailyReportConfig;
import com.sjzm.product.modules.automation.config.OperationsLogisticsAutomationConfig;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.util.StringUtils;

/**
 * 飞书请求中心接口。
 * 暴露 token 自检 + 多维表格（Bitable）操作，供系统主动调飞书开放平台 API。
 */
@RestController
@RequestMapping("/api/v1/modules/feishu")
@RequiredArgsConstructor
@Tag(name = "飞书请求中心", description = "飞书开放平台 API 统一调用（token + 多维表格）")
public class FeishuController {

    private final FeishuClient feishuClient;
    private final FeishuConfigService configService;
    private final FinanceDailyReportConfig financeConfig;
    private final OperationsLogisticsAutomationConfig operationsConfig;

    @GetMapping("/config/status")
    @Operation(summary = "查询飞书凭证和业务资源配置状态（不返回明文密钥）")
    public Result<Map<String, Object>> configStatus() {
        String appId = configService.getAppId();
        String appSecret = configService.getAppSecret();
        Map<String, Object> data = new HashMap<>();
        data.put("configured", StringUtils.hasText(appId) && StringUtils.hasText(appSecret));
        data.put("appIdMasked", mask(appId));
        data.put("appSecretConfigured", StringUtils.hasText(appSecret));
        data.put("baseUrl", "https://open.feishu.cn");
        data.put("requiredPermissions", List.of(
                "tenant_access_token", "base:table:read", "base:record:read",
                "base:record:create", "base:record:update"));
        return Result.success(data);
    }

    @PutMapping("/credentials")
    @Operation(summary = "保存飞书应用凭证（空字段保持原值）")
    public Result<Map<String, Object>> updateCredentials(@RequestBody CredentialsRequest request) {
        if (!StringUtils.hasText(request.appId()) && !StringUtils.hasText(request.appSecret())) {
            return Result.error(400, "App ID 和 App Secret 至少填写一项");
        }
        configService.updateCredentials(request.appId(), request.appSecret());
        return configStatus();
    }

    @GetMapping("/resources")
    @Operation(summary = "查询已接入飞书的业务资源状态")
    public Result<List<Map<String, Object>>> resources() {
        return Result.success(List.of(
                resource("FINANCE_DAILY_REPORT", "财务日报", financeConfig.getFeishuAppToken(),
                        Map.of("总", text(financeConfig.getFeishuTableTotal()),
                                "运营", text(financeConfig.getFeishuTableOperations()),
                                "开发", text(financeConfig.getFeishuTableDeveloper()),
                                "非标品", text(financeConfig.getFeishuTableNonstandard()),
                                "上架时间", text(financeConfig.getFeishuTableListingTime()))),
                resource("OPERATIONS_LOGISTICS_PURCHASE_PROGRESS", "运营物流采购进度",
                        operationsConfig.getFeishuAppToken(),
                        Map.of("采购进度", text(operationsConfig.getFeishuTableId())))));
    }

    @GetMapping("/resources/{code}/self-check")
    @Operation(summary = "使用后端已配置 App Token 检查业务资源可访问性")
    public Result<JsonNode> resourceSelfCheck(@PathVariable String code) {
        String appToken = switch (code.toUpperCase()) {
            case "FINANCE_DAILY_REPORT" -> financeConfig.getFeishuAppToken();
            case "OPERATIONS_LOGISTICS_PURCHASE_PROGRESS" -> operationsConfig.getFeishuAppToken();
            default -> null;
        };
        if (!StringUtils.hasText(appToken)) {
            return Result.error(400, "业务资源 App Token 未配置: " + code);
        }
        return Result.success(feishuClient.listTables(appToken));
    }

    @GetMapping("/token/self-check")
    @Operation(summary = "token 自检（换取 tenant_access_token，验证凭证与网络）")
    public Result<Map<String, Object>> tokenSelfCheck() {
        try {
            feishuClient.getTenantAccessToken();
            Map<String, Object> data = new HashMap<>();
            data.put("appId", configService.getAppId());
            data.put("status", "ok");
            data.put("message", "tenant_access_token 获取成功");
            return Result.success(data);
        } catch (Exception e) {
            return Result.error(500, "token 获取失败: " + e.getMessage());
        }
    }

    @GetMapping("/bitable/{appToken}/tables")
    @Operation(summary = "列出多维表格的数据表")
    public Result<JsonNode> listTables(@PathVariable String appToken) {
        return Result.success(feishuClient.listTables(appToken));
    }

    @GetMapping("/bitable/{appToken}/tables/{tableId}/records")
    @Operation(summary = "查询数据表记录（分页）")
    public Result<JsonNode> listRecords(
            @PathVariable String appToken,
            @PathVariable String tableId,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) String pageToken) {
        return Result.success(feishuClient.listRecords(appToken, tableId, pageSize, pageToken));
    }

    @PostMapping("/bitable/{appToken}/tables/{tableId}/records")
    @Operation(summary = "新增一条记录（body 为 fields JSON）")
    public Result<JsonNode> createRecord(
            @PathVariable String appToken,
            @PathVariable String tableId,
            @RequestBody JsonNode fields) {
        return Result.success(feishuClient.createRecord(appToken, tableId, fields));
    }

    private Map<String, Object> resource(String code, String name, String appToken,
                                         Map<String, String> tables) {
        Map<String, Object> row = new HashMap<>();
        row.put("code", code);
        row.put("name", name);
        row.put("appTokenConfigured", StringUtils.hasText(appToken));
        row.put("appTokenMasked", mask(appToken));
        row.put("tables", tables.entrySet().stream().map(entry -> Map.of(
                "name", entry.getKey(),
                "configured", StringUtils.hasText(entry.getValue()),
                "tableId", StringUtils.hasText(entry.getValue()) ? entry.getValue() : ""
        )).toList());
        row.put("configured", StringUtils.hasText(appToken)
                && tables.values().stream().allMatch(StringUtils::hasText));
        return row;
    }

    private String mask(String value) {
        if (!StringUtils.hasText(value)) return "";
        String trimmed = value.trim();
        if (trimmed.length() <= 8) return "****";
        return trimmed.substring(0, 4) + "****" + trimmed.substring(trimmed.length() - 4);
    }

    private String text(String value) {
        return value == null ? "" : value;
    }

    public record CredentialsRequest(String appId, String appSecret) {}
}
