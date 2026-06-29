package com.sjzm.product.modules.bazhuayu.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.sjzm.product.modules.bazhuayu.config.BazhuayuConfig;
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
import java.util.ArrayList;
import java.util.List;

/**
 * 八爪鱼开放平台 API 客户端（Java 移植）。
 * 参照 产品数据/八爪鱼api/bazhuayu_api.py，仿 SellerspriteApiService 风格用 java.net.http.HttpClient。
 * 只实现自动化必需端点：token、task/search、cloudextraction/start、statuses/v2、data/all。
 *
 * 凭证从 BazhuayuConfigService 读取（DB 覆盖 env），不硬编码。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BazhuayuClient {

    private final BazhuayuConfig config;
    private final BazhuayuConfigService configService;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    private volatile String accessToken = "";
    private volatile String refreshToken = "";
    private volatile long expiresAt = 0L; // 过期时间戳（毫秒）

    // ============================================================
    // Token 管理
    // ============================================================

    private synchronized void ensureToken() {
        if (accessToken.isEmpty()) {
            getToken();
            return;
        }
        // 过期前 60 秒刷新
        if (System.currentTimeMillis() >= expiresAt - 60_000L) {
            try {
                refreshAccessToken();
            } catch (Exception e) {
                log.warn("八爪鱼 token 刷新失败，重新登录获取: {}", e.getMessage());
                getToken();
            }
        }
    }

    private void getToken() {
        String username = configService.getUsername();
        String password = configService.getPassword();
        if (username == null || username.isBlank() || password == null || password.isBlank()) {
            throw new IllegalStateException("八爪鱼账号密码未配置（BAZHUAYU_USERNAME/PASSWORD 或 api_config）");
        }
        ObjectNode body = objectMapper.createObjectNode();
        body.put("username", username);
        body.put("password", password);
        body.put("grant_type", "password");
        JsonNode resp = post("/token", body, false);
        parseTokenResponse(resp);
        log.info("八爪鱼 token 获取成功");
    }

    private void refreshAccessToken() {
        ObjectNode body = objectMapper.createObjectNode();
        body.put("refresh_token", refreshToken);
        body.put("grant_type", "refresh_token");
        JsonNode resp = post("/token", body, false);
        parseTokenResponse(resp);
        log.info("八爪鱼 token 刷新成功");
    }

    private void parseTokenResponse(JsonNode resp) {
        JsonNode data = resp.path("data");
        accessToken = data.path("access_token").asText("");
        refreshToken = data.path("refresh_token").asText("");
        long expiresIn = data.path("expires_in").asLong(0L);
        expiresAt = System.currentTimeMillis() + expiresIn * 1000L;
        if (accessToken.isEmpty()) {
            throw new IllegalStateException("八爪鱼 token 响应缺少 access_token");
        }
    }

    // ============================================================
    // 任务 / 云采集 / 数据
    // ============================================================

    /** 搜索任务组下的任务，返回 [{taskId, taskName}] */
    public List<JsonNode> searchTasks(long taskGroupId) {
        JsonNode data = get("/task/search?taskGroupId=" + taskGroupId);
        List<JsonNode> list = new ArrayList<>();
        if (data.isArray()) data.forEach(list::add);
        return list;
    }

    /** 启动云采集，返回 lotNo（批次号） */
    public String startExtraction(String taskId) {
        ObjectNode body = objectMapper.createObjectNode();
        body.put("taskId", taskId);
        JsonNode data = post("/cloudextraction/start", body, true).path("data");
        return data.path("lotNo").asText(null);
    }

    /** 批量获取任务状态 V2，返回单个任务的状态节点（取第一个匹配） */
    public JsonNode getTaskStatusV2(String taskId) {
        ObjectNode body = objectMapper.createObjectNode();
        body.putArray("taskIds").add(taskId);
        JsonNode data = post("/cloudextraction/statuses/v2", body, true).path("data");
        if (data.isArray() && !data.isEmpty()) return data.get(0);
        return objectMapper.createObjectNode();
    }

    /**
     * 阻塞等待任务采集完成（状态 Finished）或超时。
     * 轮询间隔 config.statusPollIntervalSeconds，最长 config.extractionTimeoutMinutes。
     * @return true=Finished, false=超时/停止
     */
    public boolean waitForExtraction(String taskId) {
        long deadline = System.currentTimeMillis() + config.getExtractionTimeoutMinutes() * 60_000L;
        long intervalMs = Math.max(1, config.getStatusPollIntervalSeconds()) * 1000L;
        while (System.currentTimeMillis() < deadline) {
            try {
                Thread.sleep(intervalMs);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return false;
            }
            JsonNode status = getTaskStatusV2(taskId);
            String s = status.path("status").asText("");
            log.info("八爪鱼任务 {} 状态: {} (已采集 {})", taskId, s,
                    status.path("currentTotalExtractCount").asInt(0));
            if ("Finished".equalsIgnoreCase(s)) return true;
            if ("Stopped".equalsIgnoreCase(s)) {
                log.warn("八爪鱼任务 {} 已停止", taskId);
                return false;
            }
        }
        log.warn("八爪鱼任务 {} 采集等待超时（{} 分钟）", taskId, config.getExtractionTimeoutMinutes());
        return false;
    }

    /**
     * 拉取任务全部数据（offset 游标分页，restTotal<=0 停）。
     * 翻页间 sleep 2s（沿用项目惯例，避免 429）。
     * @return 数据行列表（每行是一个 JSON 对象）
     */
    public List<JsonNode> fetchAllData(String taskId) {
        List<JsonNode> all = new ArrayList<>();
        int offset = 0;
        int size = Math.min(1000, Math.max(1, config.getDataPageSize()));
        while (true) {
            JsonNode data = get("/data/all?taskId=" + enc(taskId) + "&offset=" + offset + "&size=" + size);
            JsonNode rows = data.path("data");
            if (rows.isArray()) rows.forEach(all::add);
            int restTotal = data.path("restTotal").asInt(0);
            offset = data.path("offset").asInt(offset);
            if (restTotal <= 0 || !rows.isArray() || rows.isEmpty()) break;
            sleep2s();
        }
        log.info("八爪鱼任务 {} 共拉取 {} 行", taskId, all.size());
        return all;
    }

    /**
     * 流式分页拉取：每页交给 pageHandler 后即丢弃，不累积全量（大数据量防 OOM）。
     * offset 游标分页，翻页间 sleep 2s（避免 429），restTotal<=0 停。
     *
     * @param taskId      任务 Id
     * @param pageHandler 每页（最多 dataPageSize 行）的处理回调
     * @return 总拉取行数
     */
    public int fetchAllDataStreaming(String taskId, java.util.function.Consumer<List<JsonNode>> pageHandler) {
        int offset = 0;
        int total = 0;
        int size = Math.min(1000, Math.max(1, config.getDataPageSize()));
        while (true) {
            JsonNode data = get("/data/all?taskId=" + enc(taskId) + "&offset=" + offset + "&size=" + size);
            JsonNode rows = data.path("data");
            List<JsonNode> page = new ArrayList<>();
            if (rows.isArray()) rows.forEach(page::add);
            if (!page.isEmpty()) {
                pageHandler.accept(page);
                total += page.size();
            }
            int restTotal = data.path("restTotal").asInt(0);
            offset = data.path("offset").asInt(offset);
            if (restTotal <= 0 || page.isEmpty()) break;
            sleep2s();
        }
        log.info("八爪鱼任务 {} 流式拉取共 {} 行", taskId, total);
        return total;
    }

    // ============================================================
    // HTTP 底层
    // ============================================================

    private JsonNode get(String path) {
        ensureToken();
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(config.getBaseUrl() + path))
                .header("Authorization", "Bearer " + accessToken)
                .timeout(config.getReadTimeout())
                .GET()
                .build();
        return send(req);
    }

    private JsonNode post(String path, JsonNode body, boolean needAuth) {
        if (needAuth) ensureToken();
        try {
            HttpRequest.Builder builder = HttpRequest.newBuilder()
                    .uri(URI.create(config.getBaseUrl() + path))
                    .header("Content-Type", "application/json")
                    .timeout(config.getReadTimeout())
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)));
            if (needAuth) builder.header("Authorization", "Bearer " + accessToken);
            return send(builder.build());
        } catch (Exception e) {
            throw new RuntimeException("八爪鱼请求序列化失败: " + e.getMessage(), e);
        }
    }

    private JsonNode send(HttpRequest req) {
        try {
            HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
            JsonNode body = objectMapper.readTree(resp.body());
            // 错误响应含 error 节点（参考文档错误码）
            if (body.has("error") && !body.path("error").isNull()) {
                JsonNode err = body.path("error");
                String code = err.path("code").asText("Unknown");
                String msg = err.path("message").asText("");
                throw new RuntimeException("八爪鱼 API 错误 [" + code + "] " + msg
                        + " (requestId: " + body.path("requestId").asText("") + ")");
            }
            return body;
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("八爪鱼 API 调用失败: " + e.getMessage(), e);
        }
    }

    private void sleep2s() {
        try {
            Thread.sleep(2000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private String enc(String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8);
    }
}
