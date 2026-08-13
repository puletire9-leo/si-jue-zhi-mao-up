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
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

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

    /**
     * 更新任务循环项（写采集 URL / 文本列表）。POST /task/updateLoopItems
     * 参照 产品数据/八爪鱼api/bazhuayu_api.py update_loop_items。
     * 以图识图用 loopType="UrlList"，把待识图的视觉搜索 URL 写进任务循环。
     */
    public void updateLoopItems(String taskId, String loopType, List<String> loopItems) {
        ObjectNode body = objectMapper.createObjectNode();
        body.put("taskId", taskId);
        body.put("loopType", loopType);
        com.fasterxml.jackson.databind.node.ArrayNode arr = body.putArray("loopItems");
        loopItems.forEach(arr::add);
        post("/task/updateLoopItems", body, true);
        log.info("八爪鱼任务 {} 更新循环项 {} 条（loopType={}）", taskId, loopItems.size(), loopType);
    }

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

    /**
     * 停止云采集（需旗舰+/企业/团队版权限）。
     * 失败由 send() 抛含错误码+message 的异常，调用方透传给前端，不吞。
     */
    public void stopExtraction(String taskId) {
        ObjectNode body = objectMapper.createObjectNode();
        body.put("taskId", taskId);
        post("/cloudextraction/stop", body, true);
        log.info("八爪鱼任务 {} 已请求停止云采集", taskId);
    }

    /** 批量获取任务状态 V2，返回单个任务的状态节点（取第一个匹配） */
    public JsonNode getTaskStatusV2(String taskId) {
        return getTaskStatusesV2(List.of(taskId)).getOrDefault(taskId, objectMapper.createObjectNode());
    }

    /**
     * 一次请求批量获取多个任务状态。八爪鱼 statuses/v2 原生支持 taskIds 数组，
     * 全量面板刷新必须走本方法，禁止逐任务瞬时连发导致 TooManyRequests。
     */
    public Map<String, JsonNode> getTaskStatusesV2(Collection<String> taskIds) {
        List<String> ids = taskIds == null ? List.of() : taskIds.stream()
                .filter(id -> id != null && !id.isBlank())
                .distinct()
                .toList();
        if (ids.isEmpty()) return Map.of();
        ObjectNode body = objectMapper.createObjectNode();
        var array = body.putArray("taskIds");
        ids.forEach(array::add);
        JsonNode data = post("/cloudextraction/statuses/v2", body, true).path("data");
        Map<String, JsonNode> result = new LinkedHashMap<>();
        if (!data.isArray()) return result;
        int index = 0;
        for (JsonNode status : data) {
            String returnedId = status.path("taskId").asText("");
            if (returnedId.isBlank() && index < ids.size()) returnedId = ids.get(index);
            if (!returnedId.isBlank()) result.put(returnedId, status);
            index++;
        }
        // 尚未产生过云采集记录的任务不会出现在 statuses/v2 的 data 中。
        // 保持旧版单任务查询语义：这不是接口失败，按“0 条、暂无状态”返回。
        ids.forEach(id -> result.putIfAbsent(id, objectMapper.createObjectNode()));
        return result;
    }

    /** 读取任务最新一次云采集快照；批次号由 startExecuteTime 生成。 */
    public BazhuayuBatchSnapshot getLatestBatchSnapshot(String taskId) {
        return BazhuayuBatchSnapshot.fromStatus(getTaskStatusV2(taskId));
    }

    /**
     * 阻塞等待任务采集完成（状态 Finished）或超时。
     * 轮询间隔 config.statusPollIntervalSeconds，最长 config.extractionTimeoutMinutes。
     * @return true=Finished, false=超时/停止
     */
    public boolean waitForExtraction(String taskId) {
        return waitForExtraction(taskId, null, null) == WaitResult.FINISHED;
    }

    /** 等待结果，区分四种结局供上层置不同终态。 */
    public enum WaitResult { FINISHED, TIMEOUT, STOPPED, CANCELLED }

    /**
     * 阻塞等待采集完成，带云端进度回调 + 协作式取消检查。
     * 每轮把 currentTotalExtractCount 喂给 onProgress；每轮检查 cancelled，置位即提前返回 CANCELLED。
     * @param onProgress 云端实时已采条数回调（可空）
     * @param cancelled  取消标志查询（可空）；返回 true 则停止等待
     */
    public WaitResult waitForExtraction(String taskId,
                                        java.util.function.IntConsumer onProgress,
                                        java.util.function.BooleanSupplier cancelled) {
        long deadline = System.currentTimeMillis() + config.getExtractionTimeoutMinutes() * 60_000L;
        long intervalMs = Math.max(1, config.getStatusPollIntervalSeconds()) * 1000L;
        while (System.currentTimeMillis() < deadline) {
            if (cancelled != null && cancelled.getAsBoolean()) {
                log.info("八爪鱼任务 {} 等待期间收到取消请求", taskId);
                return WaitResult.CANCELLED;
            }
            try {
                Thread.sleep(intervalMs);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return WaitResult.CANCELLED;
            }
            if (cancelled != null && cancelled.getAsBoolean()) {
                return WaitResult.CANCELLED;
            }
            JsonNode status = getTaskStatusV2(taskId);
            String s = status.path("status").asText("");
            int count = status.path("currentTotalExtractCount").asInt(0);
            log.info("八爪鱼任务 {} 状态: {} (已采集 {})", taskId, s, count);
            if (onProgress != null) onProgress.accept(count);
            if ("Finished".equalsIgnoreCase(s)) return WaitResult.FINISHED;
            if ("Stopped".equalsIgnoreCase(s)) {
                log.warn("八爪鱼任务 {} 已停止", taskId);
                return WaitResult.STOPPED;
            }
        }
        log.warn("八爪鱼任务 {} 采集等待超时（{} 分钟）", taskId, config.getExtractionTimeoutMinutes());
        return WaitResult.TIMEOUT;
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
            JsonNode data = paginationData(get("/data/all?taskId=" + enc(taskId)
                    + "&offset=" + offset + "&size=" + size));
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
            JsonNode data = paginationData(get("/data/all?taskId=" + enc(taskId)
                    + "&offset=" + offset + "&size=" + size));
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

    /**
     * 读取已由调用方确认的单次云采集数据。
     *
     * <p>系统自己启动的任务带真实 lotNo，走 /data/lotno/all 精确读取。八爪鱼网页手动或定时启动的任务，
     * statuses/v2 不返回内部 lotNo，只能读取 /data/all。该接口的 total 是任务历史累计量，因此无 lotNo 时
     * 必须以 statuses/v2 的 currentTotalExtractCount 作为最新批次硬上限，只读取最前 N 条，到数立即停止。</p>
     */
    public int fetchBatchDataStreaming(
            String taskId,
            BazhuayuBatchSnapshot batch,
            java.util.function.Consumer<List<JsonNode>> pageHandler) {
        return fetchBatchDataStreaming(taskId, batch, pageHandler, 0, 0, null);
    }

    /**
     * 断点/协作取消版：从 startOffset 起拉，alreadyProcessed 为此前已导行数（供 targetRows 完整性判定）。
     * cancelled 命中即处理完当前页后停止；此时不做“不完整批次”完整性校验（暂停是合法中断，不算失败）。
     *
     * <p>返回本轮实际处理行数（不含 alreadyProcessed）。暂停时下一个续拉 offset = startOffset + 返回值
     * （整页不截断，仅收口末页才截断，故此式精确）。</p>
     */
    public int fetchBatchDataStreaming(
            String taskId,
            BazhuayuBatchSnapshot batch,
            java.util.function.Consumer<List<JsonNode>> pageHandler,
            int startOffset,
            int alreadyProcessed,
            java.util.function.BooleanSupplier cancelled) {
        if (batch == null || batch.batchNo() == null) {
            throw new IllegalArgumentException("八爪鱼批次不能为空");
        }
        boolean exactLotNo = batch.lotNo() != null && !batch.lotNo().isBlank();
        int expectedRows = Math.max(0, batch.cloudCount());
        if (expectedRows == 0) {
            log.info("八爪鱼任务 {} 批次 {} 本批次数量为 0，无需拉取", taskId, batch.batchNo());
            return 0;
        }
        String pathPrefix = exactLotNo
                ? "/data/lotno/all?taskId=" + enc(taskId) + "&lotno=" + enc(batch.lotNo())
                : "/data/all?taskId=" + enc(taskId);
        int offset = Math.max(0, startOffset);
        int total = 0;                          // 本轮处理行数
        int size = Math.min(1000, Math.max(1, config.getDataPageSize()));
        int targetRows = exactLotNo ? 0 : expectedRows;
        boolean firstPage = true;
        boolean paused = false;
        while (true) {
            // 协作式暂停：处理完上一页后、拉下一页前检查，停在整页边界，offset 即下一个续拉点。
            if (cancelled != null && cancelled.getAsBoolean()) {
                paused = true;
                log.info("八爪鱼任务 {} 批次 {} 导入暂停：本轮已处理 {} 行，续拉 offset={}",
                        taskId, batch.batchNo(), total, offset);
                break;
            }
            JsonNode data = fetchDataPage(pathPrefix + "&offset=" + offset + "&size=" + size);
            if (firstPage) {
                int sourceTotal = data.path("total").asInt(0);
                if (exactLotNo) {
                    targetRows = sourceTotal;
                } else if (sourceTotal < expectedRows) {
                    throw new IllegalStateException("八爪鱼任务 " + taskId + " 批次 " + batch.batchNo()
                            + " 预计 " + expectedRows + " 条，但数据接口总量仅 " + sourceTotal + " 条，拒绝导入");
                }
                if (exactLotNo && sourceTotal != expectedRows) {
                    log.info("八爪鱼任务 {} 批次 {} 采集计数 {} 条，数据接口实际 {} 条（云端去重或进度差异），按实际数量导入",
                            taskId, batch.batchNo(), expectedRows, sourceTotal);
                } else if (!exactLotNo && sourceTotal > expectedRows) {
                    log.info("八爪鱼任务 {} 批次 {} 本批次 {} 条，任务历史累计 {} 条，仅导入最新批次前 {} 条",
                            taskId, batch.batchNo(), expectedRows, sourceTotal, expectedRows);
                }
                if (targetRows == 0) {
                    log.info("八爪鱼任务 {} 批次 {} 数据接口返回 0 条，跳过导入", taskId, batch.batchNo());
                    return 0;
                }
            }
            firstPage = false;
            JsonNode rows = data.path("data");
            List<JsonNode> page = new ArrayList<>();
            if (rows.isArray()) rows.forEach(page::add);
            int remaining = targetRows - alreadyProcessed - total;
            if (page.size() > remaining) {
                page = new ArrayList<>(page.subList(0, remaining));
            }
            if (!page.isEmpty()) {
                pageHandler.accept(page);
                total += page.size();
            }
            if (alreadyProcessed + total >= targetRows) break;
            int restTotal = data.path("restTotal").asInt(0);
            offset = data.path("offset").asInt(offset);
            if (restTotal <= 0 || page.isEmpty()) break;
            sleep2s();
        }
        // 暂停是合法中断，跳过“不完整批次”完整性校验；自然结束才校验。
        if (!paused && alreadyProcessed + total < targetRows) {
            throw new IllegalStateException("八爪鱼任务 " + taskId + " 批次 " + batch.batchNo()
                    + " 预计读取 " + targetRows + " 条，实际仅读取 " + (alreadyProcessed + total)
                    + " 条，拒绝按不完整批次收口");
        }
        log.info("八爪鱼任务 {} 批次 {} 流式拉取本轮 {} 行（累计 {}/{}，lotNo={}，paused={}）",
                taskId, batch.batchNo(), total, alreadyProcessed + total, targetRows, batch.lotNo(), paused);
        return total;
    }

    /** 单页数据读取 seam，包内测试可替换 HTTP，只验证批次截断与数量保护。 */
    JsonNode fetchDataPage(String path) {
        return paginationData(get(path));
    }

    /** 兼容开放平台分页字段位于响应 data 对象内或直接位于根节点两种形态。 */
    private JsonNode paginationData(JsonNode response) {
        JsonNode nested = response == null ? null : response.path("data");
        if (nested != null && nested.isObject()
                && (nested.has("data") || nested.has("total") || nested.has("restTotal"))) {
            return nested;
        }
        return response == null ? objectMapper.createObjectNode() : response;
    }

    // ============================================================
    // 增量拉取：notexported + markexported（游标式，只取未导出新数据）
    // ============================================================

    /**
     * 拉取一页未导出数据（最旧的 size 条，FIFO）。不自动标记。
     * @return 该页数据行；总量另查 total（此处只返回行，调用方按空判断停止）
     */
    public List<JsonNode> getNotExportedPage(String taskId, int size) {
        int s = Math.min(1000, Math.max(1, size));
        JsonNode data = get("/data/notexported?taskId=" + enc(taskId) + "&size=" + s).path("data");
        List<JsonNode> page = new ArrayList<>();
        JsonNode rows = data.path("data");
        if (rows.isArray()) rows.forEach(page::add);
        return page;
    }

    /** 标记"刚被 notexported 取走的那批"为已导出（游标前移，下次 notexported 跳过它们）。 */
    public void markExported(String taskId) {
        ObjectNode body = objectMapper.createObjectNode();
        body.put("taskId", taskId);
        post("/data/markexported", body, true);
    }

    /**
     * 增量 drain：循环 拉一页未导出 → 处理成功 → markExported → 重复，直到空或达上限。
     * 内存恒定（每轮只一页），已导出的下次不再返回，天然增量。
     *
     * 关键顺序：**先 pageHandler 处理落库成功，再 markExported**。
     * 处理抛异常则不标记，该页下次重试（at-least-once，靠库内唯一键 + skip_asins 幂等）。
     *
     * @param taskId      任务 Id
     * @param pageHandler 每页处理回调（写周表 + 喂初筛）
     * @param maxRows     本次最多处理行数，<=0 表示不限（首次清历史积压用）
     * @return 实际处理行数
     */
    public int drainNotExported(String taskId, java.util.function.Consumer<List<JsonNode>> pageHandler, int maxRows) {
        return drainNotExported(taskId, pageHandler, maxRows, null);
    }

    /**
     * 带协作式取消的 drain。每页处理 + markExported 之后检查 cancelled，
     * 置位即跳出循环——已处理已标记的保留，未拉取的留待下次（at-least-once 不变）。
     * @param cancelled 取消标志查询（可空）
     */
    public int drainNotExported(String taskId, java.util.function.Consumer<List<JsonNode>> pageHandler,
                                int maxRows, java.util.function.BooleanSupplier cancelled) {
        int size = Math.min(1000, Math.max(1, config.getDataPageSize()));
        int processed = 0;
        while (maxRows <= 0 || processed < maxRows) {
            if (cancelled != null && cancelled.getAsBoolean()) {
                log.info("八爪鱼任务 {} drain 收到取消请求，已处理 {} 行后停止", taskId, processed);
                break;
            }
            List<JsonNode> page = getNotExportedPage(taskId, size);
            if (page.isEmpty()) break;            // 无未导出数据，结束
            pageHandler.accept(page);             // 先处理落库（失败抛异常，不标记）
            markExported(taskId);                 // 成功后才标记，游标前移
            processed += page.size();
            if (page.size() < size) break;        // 末页（不足整页）
            sleep2s();                            // 翻页间隔，避免 429
        }
        log.info("八爪鱼任务 {} 增量 drain 共处理 {} 行", taskId, processed);
        return processed;
    }

    /**
     * 清积压：循环 notexported→markexported 把历史未导出数据全部标记已导出，**不处理不入库**。
     * 用于方案 Y——丢弃历史积压，从下一个采集批次起正常增量。
     * @return 标记掉的行数
     */
    public int markAllExported(String taskId) {
        int size = Math.min(1000, Math.max(1, config.getDataPageSize()));
        int marked = 0;
        while (true) {
            List<JsonNode> page = getNotExportedPage(taskId, size);
            if (page.isEmpty()) break;
            markExported(taskId);
            marked += page.size();
            if (page.size() < size) break;
            sleep2s();
        }
        log.info("八爪鱼任务 {} 清积压：标记已导出 {} 行", taskId, marked);
        return marked;
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

    /**
     * 翻页间隔（package-private 非 final，便于单测 spy 覆盖跳过真实 sleep）。
     * 时长走配置 bazhuayu.page-delay-ms（默认 800ms，原固定 2000ms）；<=0 不 sleep。
     * 方法名保留 sleep2s 以兼容既有单测 spy，语义已改为"可配翻页间隔"。
     */
    void sleep2s() {
        long delay = config.getPageDelayMs();
        if (delay <= 0) return;
        try {
            Thread.sleep(delay);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private String enc(String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8);
    }
}
