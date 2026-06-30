package com.sjzm.product.modules.lingxing.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.sjzm.common.Result;
import com.sjzm.product.modules.lingxing.service.LingxingClient;
import com.sjzm.product.modules.lingxing.service.LingxingConfigService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * 领星数据对接模块。
 * 前缀 /api/v1/modules/lingxing（网关 + nginx 已覆盖 /modules/**）。
 * 本期仅打通调用能力（token + 签名 + 业务接口验证），具体数据对接待方案确定后扩展。
 */
@RestController
@RequestMapping("/api/v1/modules/lingxing")
@RequiredArgsConstructor
@Tag(name = "领星数据对接", description = "领星开放平台 API 调用（token/签名/业务接口）")
public class LingxingController {

    private final LingxingClient client;
    private final LingxingConfigService configService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @PostMapping("/ping")
    @Operation(summary = "链路验证：换 token 并调一个轻量业务接口（关键词列表 1 条）")
    public Result<Map<String, Object>> ping() {
        Map<String, Object> out = new HashMap<>();
        client.getAccessToken();
        out.put("token", "OK");

        ObjectNode body = objectMapper.createObjectNode();
        body.put("offset", 0);
        body.put("length", 1);
        JsonNode resp = client.post("/erp/sc/routing/tool/toolKeywordRank/getKeywordList", body);
        out.put("code", resp.path("code").asText());
        out.put("message", resp.path("message").asText(resp.path("msg").asText("")));
        out.put("dataSize", resp.path("data").isArray() ? resp.path("data").size() : 0);
        return Result.success(out);
    }

    @PostMapping("/credentials")
    @Operation(summary = "更新领星凭证（写 api_config，覆盖环境变量）")
    public Result<Void> updateCredentials(@RequestParam String appId,
                                          @RequestParam String appSecret) {
        configService.updateCredentials(appId, appSecret);
        return Result.success();
    }

    /**
     * 通用业务接口透传：调试期用，定方案后由具体 Service 取代。
     * @param path 领星 API 路径（如 /bd/productPerformance/openApi/asinList）
     * @param body 业务请求体
     */
    @PostMapping("/call")
    @Operation(summary = "通用业务接口透传（调试用：传 path + body）")
    public Result<JsonNode> call(@RequestParam String path, @RequestBody(required = false) JsonNode body) {
        return Result.success(client.post(path, body));
    }
}
