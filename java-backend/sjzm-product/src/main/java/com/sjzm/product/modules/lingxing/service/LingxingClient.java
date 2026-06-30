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

    // ============================================================
    // Token 管理
    // ============================================================

    private synchronized void ensureToken() {
        if (accessToken.isEmpty()) {
            getAccessToken();
            return;
        }
        // 过期前 60 秒刷新；refresh 失败则重新换 token
        if (System.currentTimeMillis() >= expiresAt - 60_000L) {
            try {
                refreshAccessToken();
            } catch (Exception e) {
                log.warn("领星 token 续约失败，重新换取: {}", e.getMessage());
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
        ensureToken();
        ObjectNode bodyNode = (body != null && body.isObject())
                ? (ObjectNode) body : objectMapper.createObjectNode();

        String timestamp = String.valueOf(System.currentTimeMillis() / 1000L);
        // 签名参与：3 公共参数 + 业务参数（集合/bool 在 sign 内做字符串化）
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
        try {
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Content-Type", "application/json")
                    .timeout(config.getReadTimeout())
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(bodyNode)))
                    .build();
            return send(req);
        } catch (Exception e) {
            throw new RuntimeException("领星请求序列化失败: " + e.getMessage(), e);
        }
    }

    /**
     * GET 业务接口。所有参数（公共+业务）拼到 URL（文档 §2.3.1）。
     *
     * @param path        API 路径
     * @param queryParams 业务查询参数（可空）
     */
    public JsonNode get(String path, Map<String, Object> queryParams) {
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
        return send(req);
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

    // ============================================================
    // HTTP 底层
    // ============================================================

    private JsonNode send(HttpRequest req) {
        try {
            HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
            JsonNode body = objectMapper.readTree(resp.body());
            // 领星错误：code 非 0/200 视为失败（业务接口 code=0，token 接口 code="200"）
            String code = body.path("code").asText("");
            if (!"0".equals(code) && !"200".equals(code)) {
                String msg = body.has("msg") ? body.path("msg").asText("")
                        : body.path("message").asText("");
                throw new RuntimeException("领星 API 错误 [" + code + "] " + msg
                        + " (request_id: " + body.path("request_id").asText("") + ")");
            }
            return body;
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("领星 API 调用失败: " + e.getMessage(), e);
        }
    }

    private String enc(String s) {
        return URLEncoder.encode(s == null ? "" : s, StandardCharsets.UTF_8);
    }
}
