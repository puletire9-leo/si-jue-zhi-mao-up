package com.sjzm.product.modules.lingxing.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.sjzm.product.modules.lingxing.config.LingxingConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.Base64;
import java.util.Map;
import java.util.TreeMap;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;

/**
 * 领星开放平台 API 客户端（Java 移植）。
 * 参照 产品数据/领星数据api/lingxing_api.py（2026-06-30 实测链路打通），
 * 仿 BazhuayuClient 风格用 java.net.http.HttpClient。
 *
 * 核心：
 * - 签名：MD5(ASCII排序参数)→大写 → AES/ECB/PKCS5Padding(密钥=appId) → Base64（文档 §4）
 * - token：appId+appSecret 换 access_token/refresh_token；refresh_token 2h 一次性（文档 §3）
 * - 业务接口：公共参数(access_token/app_key/timestamp/sign) + 业务参数
 *
 * 凭证从 LingxingConfigService 读取（DB 覆盖 env），不硬编码。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LingxingClient {

    private final LingxingConfig config;
    private final LingxingConfigService configService;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    /** token 获取/续约路径（实测正确，文档 §3） */
    private static final String TOKEN_PATH = "/api/auth-server/oauth/access-token";
    private static final String REFRESH_PATH = "/api/auth-server/oauth/refresh";

    private volatile String accessToken = "";
    private volatile String refreshToken = "";
    private volatile long expiresAt = 0L; // access_token 过期时间戳（毫秒）

    /**
     * 账号级串行化门禁：领星按「账号 + 接口」限令牌桶，多个同步入口（产品表现/利润/Listing/请求中心等）
     * 共享同一账号时，所有 post/get 必须跨入口串行，否则并发请求会互相触发限流甚至 token 竞争。
     * 以 appId 为键维护一把公平 ReentrantLock，把整段「取 token → 签名 → 发送 → 重试」纳入临界区。
     */
    private final ConcurrentHashMap<String, ReentrantLock> accountLocks = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Long> requestCompletedAt = new ConcurrentHashMap<>();

    // ============================================================
    // Token 管理
    // ============================================================

    private synchronized void ensureToken() {
        if (accessToken.isEmpty()) {
            getAccessToken();
            return;
        }
        // 过期前 60 秒刷新；refresh 失败（含 refresh_token 失效/用尽）则重新用 appId+secret 换全新 token
        if (System.currentTimeMillis() >= expiresAt - 60_000L) {
            try {
                refreshAccessToken();
            } catch (Exception e) {
                log.warn("领星 token 续约失败，重新换取: {}", e.getMessage());
                refreshToken = ""; // 作废失效的 refresh_token，避免下次再拿它续约
                getAccessToken();
            }
        }
    }

    /**
     * 换取 access_token（凭 appId + appSecret，query 传参，本接口不参与业务签名）。
     * 成功后写入 accessToken/refreshToken/expiresAt。
     */
    public synchronized void getAccessToken() {
        String appId = configService.getAppId();
        String appSecret = configService.getAppSecret();
        if (appId == null || appId.isBlank() || appSecret == null || appSecret.isBlank()) {
            throw new IllegalStateException("领星 AppId/AppSecret 未配置（LINGXING_APP_ID/SECRET 或 api_config）");
        }
        String url = config.getBaseUrl() + TOKEN_PATH
                + "?appId=" + enc(appId) + "&appSecret=" + enc(appSecret);
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(config.getReadTimeout())
                .POST(HttpRequest.BodyPublishers.noBody())
                .build();
        parseTokenResponse(send(req));
        log.info("领星 access_token 获取成功（expiresAt={}）", expiresAt);
    }

    /**
     * 续约 access_token。refresh_token 2 小时有效且只能用一次，
     * 每次续约返回新的 refresh_token（文档 §3.2）。
     */
    public synchronized void refreshAccessToken() {
        if (refreshToken == null || refreshToken.isBlank()) {
            throw new IllegalStateException("领星 refresh_token 为空，无法续约");
        }
        String appId = configService.getAppId();
        String url = config.getBaseUrl() + REFRESH_PATH
                + "?appId=" + enc(appId) + "&refreshToken=" + enc(refreshToken);
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(config.getReadTimeout())
                .POST(HttpRequest.BodyPublishers.noBody())
                .build();
        parseTokenResponse(send(req));
        log.info("领星 access_token 续约成功");
    }

    private void parseTokenResponse(JsonNode resp) {
        JsonNode data = resp.path("data");
        String at = data.path("access_token").asText("");
        String rt = data.path("refresh_token").asText("");
        long expiresIn = data.path("expires_in").asLong(0L);
        if (at.isEmpty()) {
            throw new IllegalStateException("领星 token 响应缺少 access_token: " + resp);
        }
        accessToken = at;
        if (!rt.isEmpty()) refreshToken = rt;
        expiresAt = System.currentTimeMillis() + expiresIn * 1000L;
    }

    // ============================================================
    // 业务接口调用
    // ============================================================

    /**
     * POST 业务接口。公共参数(access_token/app_key/timestamp)+业务参数一起参与签名；
     * 签名后 URL 只带 4 个公共参数(含 sign)，业务参数放 body（文档 §2.3.2）。
     *
     * @param path API 路径（不含域名），如 /erp/sc/routing/tool/toolKeywordRank/getKeywordList
     * @param body 业务请求体；null 视作空对象
     * @return 接口响应 JSON
     */
    public JsonNode post(String path, JsonNode body) {
        return withAccountGate(() -> doPost(path, body));
    }

    /**
     * 产品表现限流探针专用调用。仍经过账号级串行门禁、统一 token/签名和请求时间轴，
     * 但不执行普通业务请求的限流重试，便于在短时间预算内观察真实 103。
     */
    public ProbeCallResult postRateProbe(String path, JsonNode body, long intervalMs) {
        if (intervalMs < 500L || intervalMs > 60_000L) {
            throw new IllegalArgumentException("探针请求间隔必须在 500~60000ms");
        }
        return withAccountGate(() -> doPostRateProbe(path, body, intervalMs));
    }

    private JsonNode doPost(String path, JsonNode body) {
        ObjectNode bodyNode = (body != null && body.isObject())
                ? (ObjectNode) body : objectMapper.createObjectNode();
        String payload;
        try {
            payload = objectMapper.writeValueAsString(bodyNode);
        } catch (Exception e) {
            throw new RuntimeException("领星请求序列化失败: " + e.getMessage(), e);
        }
        // token 失效（长任务中途过期）时强制刷新并用新 token 重拼重发，最多重试 1 次
        for (int tokenRetry = 0; ; tokenRetry++) {
            ensureToken();
            String timestamp = String.valueOf(System.currentTimeMillis() / 1000L);
            TreeMap<String, Object> signParams = new TreeMap<>();
            signParams.put("access_token", accessToken);
            signParams.put("app_key", configService.getAppId());
            signParams.put("timestamp", timestamp);
            bodyNode.fields().forEachRemaining(e -> signParams.put(e.getKey(), e.getValue()));
            String sign = generateSign(signParams);

            String url = config.getBaseUrl() + path
                    + "?access_token=" + enc(accessToken)
                    + "&app_key=" + enc(configService.getAppId())
                    + "&timestamp=" + timestamp
                    + "&sign=" + enc(sign);
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Content-Type", "application/json")
                    .timeout(config.getReadTimeout())
                    .POST(HttpRequest.BodyPublishers.ofString(payload))
                    .build();
            try {
                return send(req);
            } catch (TokenInvalidException tie) {
                if (tokenRetry >= 1) throw new RuntimeException("领星 token 反复失效: " + tie.getMessage(), tie);
                log.warn("领星 token 失效，强制刷新后重发（第 {} 次）", tokenRetry + 1);
                forceRefreshToken();
            }
        }
    }

    /**
     * GET 业务接口。所有参数（公共+业务）拼到 URL（文档 §2.3.1）。
     *
     * @param path        API 路径
     * @param queryParams 业务查询参数（可空）
     */
    public JsonNode get(String path, Map<String, Object> queryParams) {
        return withAccountGate(() -> doGet(path, queryParams));
    }

    private JsonNode doGet(String path, Map<String, Object> queryParams) {
        for (int tokenRetry = 0; ; tokenRetry++) {
            ensureToken();
            String timestamp = String.valueOf(System.currentTimeMillis() / 1000L);
            TreeMap<String, Object> signParams = new TreeMap<>();
            signParams.put("access_token", accessToken);
            signParams.put("app_key", configService.getAppId());
            signParams.put("timestamp", timestamp);
            if (queryParams != null) signParams.putAll(queryParams);
            String sign = generateSign(signParams);

            StringBuilder url = new StringBuilder(config.getBaseUrl()).append(path).append("?");
            signParams.forEach((k, v) -> url.append(enc(k)).append("=").append(enc(stringify(v))).append("&"));
            url.append("sign=").append(enc(sign));

            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(url.toString()))
                    .timeout(config.getReadTimeout())
                    .GET()
                    .build();
            try {
                return send(req);
            } catch (TokenInvalidException tie) {
                if (tokenRetry >= 1) throw new RuntimeException("领星 token 反复失效: " + tie.getMessage(), tie);
                log.warn("领星 token 失效，强制刷新后重发（第 {} 次）", tokenRetry + 1);
                forceRefreshToken();
            }
        }
    }

    /** 强制作废当前 token 并重新换取（token 失效码触发）。 */
    private synchronized void forceRefreshToken() {
        accessToken = "";
        expiresAt = 0L;
        getAccessToken();
    }

    /** token 失效专用异常：区别于限流，需刷新 token 重拼请求，不能白等重试。 */
    private static class TokenInvalidException extends RuntimeException {
        TokenInvalidException(String msg) { super(msg); }
    }

    // ============================================================
    // 签名（文档 §4：MD5→大写 → AES/ECB/PKCS5Padding(密钥=appId) → Base64）
    // ============================================================

    /**
     * 生成接口签名。参照 lingxing_api.py _generate_sign：
     * 1. 空值("")和 null 不参与；2. bool→"true"/"false"；3. 集合→紧凑 JSON 字符串；
     * 4. ASCII 排序 key=value&... ；5. MD5(32位)大写；6. AES/ECB(密钥=appId) → Base64。
     */
    String generateSign(Map<String, Object> params) {
        TreeMap<String, String> filtered = new TreeMap<>();
        for (Map.Entry<String, Object> e : params.entrySet()) {
            String v = stringify(e.getValue());
            if (v == null || v.isEmpty()) continue; // 空值不参与
            filtered.put(e.getKey(), v);
        }
        StringBuilder sb = new StringBuilder();
        filtered.forEach((k, v) -> {
            if (sb.length() > 0) sb.append("&");
            sb.append(k).append("=").append(v);
        });
        try {
            String md5Upper = md5Hex(sb.toString()).toUpperCase();
            SecretKeySpec key = new SecretKeySpec(
                    configService.getAppId().getBytes(StandardCharsets.UTF_8), "AES");
            Cipher cipher = Cipher.getInstance("AES/ECB/PKCS5Padding");
            cipher.init(Cipher.ENCRYPT_MODE, key);
            byte[] encrypted = cipher.doFinal(md5Upper.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(encrypted);
        } catch (Exception ex) {
            throw new RuntimeException("领星签名生成失败: " + ex.getMessage(), ex);
        }
    }

    /** 把签名值转字符串：集合→紧凑 JSON；bool→true/false；其余 toString。 */
    private String stringify(Object v) {
        if (v == null) return null;
        if (v instanceof JsonNode node) {
            if (node.isNull()) return null;
            if (node.isBoolean()) return node.asBoolean() ? "true" : "false";
            if (node.isValueNode()) return node.asText();
            return node.toString(); // 数组/对象 → 紧凑 JSON（Jackson 默认无空格）
        }
        if (v instanceof Boolean b) return b ? "true" : "false";
        return v.toString();
    }

    private String md5Hex(String s) throws Exception {
        byte[] digest = MessageDigest.getInstance("MD5").digest(s.getBytes(StandardCharsets.UTF_8));
        StringBuilder hex = new StringBuilder();
        for (byte b : digest) {
            String h = Integer.toHexString(0xff & b);
            if (h.length() == 1) hex.append('0');
            hex.append(h);
        }
        return hex.toString();
    }

    private static final int RATE_LIMIT_RETRIES = 8;
    /**
     * 采用艾为的请求前主动节流思路：普通请求 500ms；产品表现接口保持正式全页链路
     * 已验证成功的响应完成后 10s。小页探针用于观测边界，不能直接替代正式全页参数。
     */
    private static final long DEFAULT_REQUEST_INTERVAL_MS = 500L;
    private static final long PRODUCT_PERFORMANCE_REQUEST_INTERVAL_MS = 10_000L;
    /** 主动节流后限流只做短退避，避免 30/60/90 秒递增造成任务长时间空等。 */
    private static final long RATE_LIMIT_BACKOFF_MS = 2_000L;

    // ============================================================
    // HTTP 底层
    // ============================================================

    private JsonNode send(HttpRequest req) {
        RuntimeException lastFailure = null;
        for (int attempt = 0; attempt <= RATE_LIMIT_RETRIES; attempt++) {
            paceBeforeRequest(req);

            JsonNode body;
            try {
                HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
                body = objectMapper.readTree(resp.body());
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new RuntimeException("领星 API 调用被中断", e);
            } catch (Exception e) {
                lastFailure = new RuntimeException("领星 API 临时失败: " + e.getMessage(), e);
                if (attempt >= RATE_LIMIT_RETRIES) break;
                waitBeforeRetry(lastFailure.getMessage(), attempt);
                continue;
            } finally {
                markRequestCompleted(req);
            }

            String code = body.path("code").asText("");
            if (isTokenInvalidCode(code)) {
                String msg = responseMessage(body);
                throw new TokenInvalidException("[" + code + "] " + msg);
            }
            if (isRateLimitCode(code)) {
                lastFailure = new RuntimeException("领星 API 限流(" + code + ")");
                if (attempt >= RATE_LIMIT_RETRIES) break;
                waitBeforeRetry(lastFailure.getMessage(), attempt);
                continue;
            }
            if (!"0".equals(code) && !"200".equals(code)) {
                throw new RuntimeException("领星 API 错误 [" + code + "] " + responseMessage(body)
                        + " (request_id: " + body.path("request_id").asText("") + ")");
            }
            return body;
        }
        throw new RuntimeException("领星 API 调用失败，重试" + RATE_LIMIT_RETRIES + "次后仍未恢复",
                lastFailure);
    }

    private ProbeCallResult sendProbeOnce(HttpRequest req, long intervalMs) {
        long pacingWaitMs = paceBeforeRequest(req, intervalMs);
        long startedAt = System.currentTimeMillis();
        JsonNode body;
        try {
            HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
            body = objectMapper.readTree(resp.body());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("领星 API 探针被中断", e);
        } catch (Exception e) {
            throw new RuntimeException("领星 API 探针失败: " + e.getMessage(), e);
        } finally {
            markRequestCompleted(req);
        }
        long completedAt = System.currentTimeMillis();
        String code = body.path("code").asText("");
        if (isTokenInvalidCode(code)) {
            throw new TokenInvalidException("[" + code + "] " + responseMessage(body));
        }
        return new ProbeCallResult(body, code, isRateLimitCode(code), pacingWaitMs,
                startedAt, completedAt, completedAt - startedAt);
    }

    public record ProbeCallResult(
            JsonNode response,
            String code,
            boolean rateLimited,
            long pacingWaitMs,
            long startedAtEpochMs,
            long completedAtEpochMs,
            long responseDurationMs
    ) { }

    private String responseMessage(JsonNode body) {
        return body.has("msg") ? body.path("msg").asText("")
                : body.path("message").asText("");
    }

    private void paceBeforeRequest(HttpRequest req) {
        paceBeforeRequest(req, requestIntervalMs(req.uri().getPath()));
    }

    private long paceBeforeRequest(HttpRequest req, long interval) {
        String path = req.uri().getPath();
        String key = requestPacingKey(path);
        long now = System.currentTimeMillis();
        long lastCompleted = requestCompletedAt.getOrDefault(key, 0L);
        long wait = interval - (now - lastCompleted);
        if (wait > 0) sleep(wait);
        return Math.max(0L, wait);
    }

    private void markRequestCompleted(HttpRequest req) {
        requestCompletedAt.put(requestPacingKey(req.uri().getPath()), System.currentTimeMillis());
    }

    private String requestPacingKey(String path) {
        return accountKey() + ":" + requestFamily(path);
    }

    long requestIntervalMs(String path) {
        return path != null && path.contains("/bd/productPerformance/")
                ? PRODUCT_PERFORMANCE_REQUEST_INTERVAL_MS
                : DEFAULT_REQUEST_INTERVAL_MS;
    }

    private String requestFamily(String path) {
        return path != null && path.contains("/bd/productPerformance/")
                ? "product-performance"
                : "default";
    }

    private void waitBeforeRetry(String reason, int attempt) {
        long wait = RATE_LIMIT_BACKOFF_MS * (attempt + 1);
        log.warn("{}，第{}次重试，等待{}ms", reason, attempt + 1, wait);
        sleep(wait);
    }

    private void sleep(long wait) {
        try {
            Thread.sleep(wait);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("领星请求等待被中断", e);
        }
    }

    private ProbeCallResult doPostRateProbe(String path, JsonNode body, long intervalMs) {
        ObjectNode bodyNode = (body != null && body.isObject())
                ? (ObjectNode) body : objectMapper.createObjectNode();
        String payload;
        try {
            payload = objectMapper.writeValueAsString(bodyNode);
        } catch (Exception e) {
            throw new RuntimeException("领星请求序列化失败: " + e.getMessage(), e);
        }
        for (int tokenRetry = 0; ; tokenRetry++) {
            ensureToken();
            String timestamp = String.valueOf(System.currentTimeMillis() / 1000L);
            TreeMap<String, Object> signParams = new TreeMap<>();
            signParams.put("access_token", accessToken);
            signParams.put("app_key", configService.getAppId());
            signParams.put("timestamp", timestamp);
            bodyNode.fields().forEachRemaining(e -> signParams.put(e.getKey(), e.getValue()));
            String sign = generateSign(signParams);
            String url = config.getBaseUrl() + path
                    + "?access_token=" + enc(accessToken)
                    + "&app_key=" + enc(configService.getAppId())
                    + "&timestamp=" + timestamp
                    + "&sign=" + enc(sign);
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Content-Type", "application/json")
                    .timeout(config.getReadTimeout())
                    .POST(HttpRequest.BodyPublishers.ofString(payload))
                    .build();
            try {
                return sendProbeOnce(req, intervalMs);
            } catch (TokenInvalidException tie) {
                if (tokenRetry >= 1) {
                    throw new RuntimeException("领星 token 反复失效: " + tie.getMessage(), tie);
                }
                forceRefreshToken();
            }
        }
    }

    private boolean isRateLimitCode(String code) {
        return "3001008".equals(code) || "103".equals(code);
    }

    /**
     * token 失效码：2001005 access token not match、2001002 token 过期、2001001、
     * 2001009 refresh token invalid（续约用的 refresh_token 失效/用尽，需重新换全新 token）。
     */
    private boolean isTokenInvalidCode(String code) {
        return "2001005".equals(code) || "2001002".equals(code)
                || "2001001".equals(code) || "2001009".equals(code);
    }

    private String enc(String s) {
        return URLEncoder.encode(s == null ? "" : s, StandardCharsets.UTF_8);
    }

    // ============================================================
    // 账号级串行化门禁
    // ============================================================

    private String accountKey() {
        String appId = configService.getAppId();
        return (appId == null || appId.isBlank()) ? "default" : appId;
    }

    private ReentrantLock accountLock() {
        return accountLocks.computeIfAbsent(accountKey(), ignored -> new ReentrantLock(true));
    }

    private <T> T withAccountGate(java.util.function.Supplier<T> action) {
        ReentrantLock lock = accountLock();
        lock.lock();
        try {
            return action.get();
        } finally {
            lock.unlock();
        }
    }
}
