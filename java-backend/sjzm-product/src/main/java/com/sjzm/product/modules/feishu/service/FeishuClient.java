package com.sjzm.product.modules.feishu.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.sjzm.product.modules.feishu.config.FeishuConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;

/**
 * 飞书开放平台 API 客户端。
 * 仿 LingxingClient 风格（java.net.http.HttpClient + ObjectMapper + token 缓存/过期刷新）。
 *
 * <p>核心：
 * <ul>
 *   <li>tenant_access_token：app_id+app_secret 直换（无签名），2h 有效，过期前 5min 刷新。
 *       实测端点 {@code POST /open-apis/auth/v3/tenant_access_token/internal}（2026-08-13 验证 code=0）。</li>
 *   <li>通用 get/post：自动带 {@code Authorization: Bearer <token>}，token 失效(99991663/99991661)强制刷新重发。</li>
 *   <li>多维表格 Bitable：表/字段/记录 CRUD 便捷方法。</li>
 * </ul>
 *
 * <p>凭证从 FeishuConfigService 读取（DB 覆盖 env），不硬编码。token 不落明文日志。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FeishuClient {

    private final FeishuConfig config;
    private final FeishuConfigService configService;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    private static final String TOKEN_PATH = "/open-apis/auth/v3/tenant_access_token/internal";

    private volatile String tenantAccessToken = "";
    private volatile long expiresAt = 0L; // 毫秒

    // ============================================================
    // Token 管理
    // ============================================================

    private synchronized void ensureToken() {
        // 过期前 5 分钟刷新（token 有效期 2h）
        if (tenantAccessToken.isEmpty() || System.currentTimeMillis() >= expiresAt - 300_000L) {
            getTenantAccessToken();
        }
    }

    /**
     * 换取 tenant_access_token（凭 app_id + app_secret，body 传参，无签名）。
     * 成功后写入 tenantAccessToken/expiresAt。
     */
    public synchronized void getTenantAccessToken() {
        String appId = configService.getAppId();
        String appSecret = configService.getAppSecret();
        if (appId == null || appId.isBlank() || appSecret == null || appSecret.isBlank()) {
            throw new IllegalStateException("飞书 AppId/AppSecret 未配置（FEISHU_APP_ID/SECRET 或 api_config）");
        }
        ObjectNode body = objectMapper.createObjectNode();
        body.put("app_id", appId);
        body.put("app_secret", appSecret);
        String payload;
        try {
            payload = objectMapper.writeValueAsString(body);
        } catch (Exception e) {
            throw new RuntimeException("飞书 token 请求序列化失败: " + e.getMessage(), e);
        }
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(config.getBaseUrl() + TOKEN_PATH))
                .header("Content-Type", "application/json; charset=utf-8")
                .timeout(config.getReadTimeout())
                .POST(HttpRequest.BodyPublishers.ofString(payload, StandardCharsets.UTF_8))
                .build();
        JsonNode resp = sendRaw(req);
        int code = resp.path("code").asInt(-1);
        if (code != 0) {
            throw new IllegalStateException("飞书 token 获取失败 [" + code + "] " + resp.path("msg").asText(""));
        }
        String token = resp.path("tenant_access_token").asText("");
        long expire = resp.path("expire").asLong(0L); // 秒
        if (token.isEmpty()) {
            throw new IllegalStateException("飞书 token 响应缺少 tenant_access_token: " + resp.path("msg").asText(""));
        }
        tenantAccessToken = token;
        expiresAt = System.currentTimeMillis() + expire * 1000L;
        log.info("飞书 tenant_access_token 获取成功（{}s 后过期）", expire);
    }

    /** 强制作废并重新换取（token 失效码触发）。 */
    private synchronized void forceRefreshToken() {
        tenantAccessToken = "";
        expiresAt = 0L;
        getTenantAccessToken();
    }

    // ============================================================
    // 通用业务调用
    // ============================================================

    /**
     * POST 业务接口（JSON body）。自动带 Bearer token，token 失效强制刷新重发（最多 1 次）。
     *
     * @param path API 路径（不含域名），如 /open-apis/bitable/v1/apps/{app_token}/tables
     * @param body 请求体；null 视作空对象
     */
    public JsonNode post(String path, JsonNode body) {
        String payload = serialize(body);
        for (int tokenRetry = 0; ; tokenRetry++) {
            ensureToken();
            HttpRequest req = authedBuilder(path)
                    .header("Content-Type", "application/json; charset=utf-8")
                    .POST(HttpRequest.BodyPublishers.ofString(payload, StandardCharsets.UTF_8))
                    .build();
            try {
                return sendBusiness(req);
            } catch (TokenInvalidException tie) {
                if (tokenRetry >= 1) throw new RuntimeException("飞书 token 反复失效: " + tie.getMessage(), tie);
                log.warn("飞书 token 失效，强制刷新后重发（第 {} 次）", tokenRetry + 1);
                forceRefreshToken();
            }
        }
    }

    /** GET 业务接口。queryParams 拼到 URL。 */
    public JsonNode get(String path, Map<String, Object> queryParams) {
        for (int tokenRetry = 0; ; tokenRetry++) {
            ensureToken();
            StringBuilder url = new StringBuilder(path);
            if (queryParams != null && !queryParams.isEmpty()) {
                url.append("?");
                queryParams.forEach((k, v) ->
                        url.append(enc(k)).append("=").append(enc(String.valueOf(v))).append("&"));
                url.setLength(url.length() - 1);
            }
            HttpRequest req = authedBuilder(url.toString()).GET().build();
            try {
                return sendBusiness(req);
            } catch (TokenInvalidException tie) {
                if (tokenRetry >= 1) throw new RuntimeException("飞书 token 反复失效: " + tie.getMessage(), tie);
                log.warn("飞书 token 失效，强制刷新后重发（第 {} 次）", tokenRetry + 1);
                forceRefreshToken();
            }
        }
    }

    // ============================================================
    // 多维表格（Bitable）便捷方法
    // ============================================================

    /** 列出多维表格的数据表。 */
    public JsonNode listTables(String appToken) {
        return get("/open-apis/bitable/v1/apps/" + appToken + "/tables", null);
    }

    /** 查询某数据表的记录（分页，pageToken 可空）。 */
    public JsonNode listRecords(String appToken, String tableId, Integer pageSize, String pageToken) {
        java.util.Map<String, Object> q = new java.util.LinkedHashMap<>();
        if (pageSize != null) q.put("page_size", pageSize);
        if (pageToken != null && !pageToken.isBlank()) q.put("page_token", pageToken);
        return get("/open-apis/bitable/v1/apps/" + appToken + "/tables/" + tableId + "/records", q);
    }

    /** 新增一条记录（fields 为字段名→值的 JSON 对象）。 */
    public JsonNode createRecord(String appToken, String tableId, JsonNode fields) {
        ObjectNode body = objectMapper.createObjectNode();
        body.set("fields", fields);
        return post("/open-apis/bitable/v1/apps/" + appToken + "/tables/" + tableId + "/records", body);
    }

    /** 批量新增记录（records 为数组，每项含 fields）。 */
    public JsonNode batchCreateRecords(String appToken, String tableId, JsonNode records) {
        ObjectNode body = objectMapper.createObjectNode();
        body.set("records", records);
        return post("/open-apis/bitable/v1/apps/" + appToken + "/tables/" + tableId + "/records/batch_create", body);
    }

    /** 更新一条记录（fields 为字段名到值的 JSON 对象）。 */
    public JsonNode updateRecord(String appToken, String tableId, String recordId, JsonNode fields) {
        ObjectNode body = objectMapper.createObjectNode();
        body.set("fields", fields);
        return put("/open-apis/bitable/v1/apps/" + appToken + "/tables/" + tableId
                + "/records/" + recordId, body);
    }

    /** 批量更新记录（records 每项包含 record_id 和 fields）。 */
    public JsonNode batchUpdateRecords(String appToken, String tableId, JsonNode records) {
        ObjectNode body = objectMapper.createObjectNode();
        body.set("records", records);
        return post("/open-apis/bitable/v1/apps/" + appToken + "/tables/" + tableId
                + "/records/batch_update", body);
    }

    // ============================================================
    // HTTP 底层
    // ============================================================

    private HttpRequest.Builder authedBuilder(String path) {
        return HttpRequest.newBuilder()
                .uri(URI.create(config.getBaseUrl() + path))
                .header("Authorization", "Bearer " + tenantAccessToken)
                .timeout(config.getReadTimeout());
    }

    private JsonNode put(String path, JsonNode body) {
        String payload = serialize(body);
        for (int tokenRetry = 0; ; tokenRetry++) {
            ensureToken();
            HttpRequest req = authedBuilder(path)
                    .header("Content-Type", "application/json; charset=utf-8")
                    .PUT(HttpRequest.BodyPublishers.ofString(payload, StandardCharsets.UTF_8))
                    .build();
            try {
                return sendBusiness(req);
            } catch (TokenInvalidException tie) {
                if (tokenRetry >= 1) throw new RuntimeException("飞书 token 反复失效: " + tie.getMessage(), tie);
                forceRefreshToken();
            }
        }
    }

    /** 业务响应：校验飞书统一 code，token 失效抛专用异常触发刷新重发。 */
    private JsonNode sendBusiness(HttpRequest req) {
        JsonNode body = sendRaw(req);
        int code = body.path("code").asInt(-1);
        if (isTokenInvalidCode(code)) {
            throw new TokenInvalidException("[" + code + "] " + body.path("msg").asText(""));
        }
        if (code != 0) {
            throw new RuntimeException("飞书 API 错误 [" + code + "] " + body.path("msg").asText(""));
        }
        return body;
    }

    /** 原始发送：仅做网络与 JSON 解析，不校验业务 code（token 接口/业务接口共用）。 */
    private JsonNode sendRaw(HttpRequest req) {
        try {
            HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            return objectMapper.readTree(resp.body());
        } catch (Exception e) {
            throw new RuntimeException("飞书 API 调用失败: " + e.getMessage(), e);
        }
    }

    /** token 失效码：99991663 tenant_access_token 无效 / 99991661 已过期。 */
    private boolean isTokenInvalidCode(int code) {
        return code == 99991663 || code == 99991661 || code == 99991664;
    }

    private String serialize(JsonNode body) {
        ObjectNode node = (body != null && body.isObject()) ? (ObjectNode) body : objectMapper.createObjectNode();
        try {
            return objectMapper.writeValueAsString(node);
        } catch (Exception e) {
            throw new RuntimeException("飞书请求序列化失败: " + e.getMessage(), e);
        }
    }

    private String enc(String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8);
    }

    /** token 失效专用异常：区别于普通错误，需刷新 token 重发。 */
    private static class TokenInvalidException extends RuntimeException {
        TokenInvalidException(String msg) { super(msg); }
    }
}
