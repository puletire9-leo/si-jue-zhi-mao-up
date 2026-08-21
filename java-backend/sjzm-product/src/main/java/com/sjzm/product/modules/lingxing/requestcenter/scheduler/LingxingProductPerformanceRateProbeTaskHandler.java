package com.sjzm.product.modules.lingxing.requestcenter.scheduler;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.sjzm.product.modules.lingxing.entity.LingxingSeller;
import com.sjzm.product.modules.lingxing.requestcenter.handler.LingxingTaskExecutionContext;
import com.sjzm.product.modules.lingxing.requestcenter.handler.LingxingTaskHandler;
import com.sjzm.product.modules.lingxing.requestcenter.handler.LingxingTaskResult;
import com.sjzm.product.modules.lingxing.service.LingxingClient;
import com.sjzm.product.rds.finance.mapper.FinanceRdsSellerMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

/**
 * 产品表现接口小请求限流探针。
 *
 * <p>只读领星响应并输出请求级耗时，不写 RDS、不触发数据加工、不投递飞书。
 * 任务仍由领星请求中心单线程执行，避免与正式自动化并发。</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class LingxingProductPerformanceRateProbeTaskHandler implements LingxingTaskHandler {

    public static final String TASK_TYPE = "LINGXING_PRODUCT_PERFORMANCE_RATE_PROBE";
    private static final String PATH = "/bd/productPerformance/openApi/asinList";
    private static final int DEFAULT_MAX_DURATION_SECONDS = 170;

    private final FinanceRdsSellerMapper sellerMapper;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public String taskType() {
        return TASK_TYPE;
    }

    @Override
    public LingxingTaskResult execute(LingxingTaskExecutionContext context) {
        JsonNode payload = context.getPayload();
        String marketplace = text(payload, "marketplace", "UK").toUpperCase(Locale.ROOT);
        long mid = switch (marketplace) {
            case "UK" -> 4L;
            case "DE" -> 5L;
            default -> throw new IllegalArgumentException("探针 marketplace 仅支持 UK/DE");
        };
        LocalDate reportDate = LocalDate.parse(text(payload, "reportDate", LocalDate.now().minusDays(1).toString()));
        int sidLimit = boundedInt(payload, "sidLimit", 5, 1, 20);
        int pageSize = boundedInt(payload, "pageSize", 100, 10, 500);
        int maxRequests = boundedInt(payload, "maxRequests", 20, 1, 30);
        long intervalMs = boundedLong(payload, "requestIntervalMs", 10_000L, 500L, 60_000L);
        int maxDurationSeconds = boundedInt(payload, "maxDurationSeconds",
                DEFAULT_MAX_DURATION_SECONDS, 30, 180);

        List<Long> sids = sellerMapper.selectList(new LambdaQueryWrapper<LingxingSeller>()
                        .eq(LingxingSeller::getStatus, 1)
                        .eq(LingxingSeller::getMid, mid))
                .stream()
                .map(LingxingSeller::getSid)
                .filter(java.util.Objects::nonNull)
                .sorted(Comparator.naturalOrder())
                .limit(sidLimit)
                .toList();
        if (sids.isEmpty()) {
            throw new IllegalStateException("RDS 无有效 " + marketplace + " 店铺 sid");
        }

        long taskStartedAt = System.currentTimeMillis();
        long deadline = taskStartedAt + maxDurationSeconds * 1000L;
        long previousCompletedAt = 0L;
        int requestCount = 0;
        int successCount = 0;
        int rateLimitCount = 0;
        int fetchedRows = 0;
        boolean durationBudgetReached = false;
        ArrayNode calls = objectMapper.createArrayNode();

        for (int page = 0; page < maxRequests; page++) {
            if (System.currentTimeMillis() + intervalMs >= deadline) {
                durationBudgetReached = true;
                break;
            }
            ObjectNode body = objectMapper.createObjectNode();
            body.put("offset", page * pageSize);
            body.put("length", pageSize);
            body.put("sort_field", "volume");
            body.put("sort_type", "desc");
            body.put("summary_field", "asin");
            ArrayNode sidArray = body.putArray("sid");
            sids.forEach(sidArray::add);
            body.put("start_date", reportDate.toString());
            body.put("end_date", reportDate.toString());
            body.put("currency_code", "GBP");
            body.put("is_recently_enum", false);

            LingxingClient.ProbeCallResult call = context.getClient().postRateProbe(PATH, body, intervalMs);
            requestCount++;
            int rows = call.response().path("data").path("list").isArray()
                    ? call.response().path("data").path("list").size() : 0;
            fetchedRows += rows;
            ObjectNode callJson = calls.addObject();
            callJson.put("requestNo", requestCount);
            callJson.put("offset", page * pageSize);
            callJson.put("code", call.code());
            callJson.put("rows", rows);
            callJson.put("startedAtEpochMs", call.startedAtEpochMs());
            callJson.put("completedAtEpochMs", call.completedAtEpochMs());
            callJson.put("responseDurationMs", call.responseDurationMs());
            callJson.put("pacingWaitMs", call.pacingWaitMs());
            if (previousCompletedAt > 0L) {
                callJson.put("actualGapFromPreviousCompletionMs", call.startedAtEpochMs() - previousCompletedAt);
            }
            previousCompletedAt = call.completedAtEpochMs();

            if (call.rateLimited()) {
                rateLimitCount++;
                break;
            }
            if (!"0".equals(call.code()) && !"200".equals(call.code())) {
                throw new IllegalStateException("领星探针返回业务错误 [" + call.code() + "]");
            }
            successCount++;
            if (rows < pageSize) {
                break;
            }
        }

        long elapsedMs = System.currentTimeMillis() - taskStartedAt;
        long recommendedIntervalMs = recommendInterval(intervalMs, successCount, rateLimitCount);
        ObjectNode result = objectMapper.createObjectNode();
        result.put("probeOnly", true);
        result.put("persistedToRds", false);
        result.put("publishedToFeishu", false);
        result.put("marketplace", marketplace);
        result.put("reportDate", reportDate.toString());
        result.put("sidCount", sids.size());
        result.set("sids", objectMapper.valueToTree(new ArrayList<>(sids)));
        result.put("pageSize", pageSize);
        result.put("requestIntervalMs", intervalMs);
        result.put("maxDurationSeconds", maxDurationSeconds);
        result.put("requestCount", requestCount);
        result.put("successCount", successCount);
        result.put("rateLimitCount", rateLimitCount);
        result.put("fetchedRows", fetchedRows);
        result.put("elapsedMs", elapsedMs);
        result.put("durationBudgetReached", durationBudgetReached);
        result.put("recommendedNextIntervalMs", recommendedIntervalMs);
        result.set("calls", calls);
        log.info("领星产品表现限流探针完成: taskId={}, interval={}ms, requests={}, 103={}, elapsed={}ms",
                context.getTaskId(), intervalMs, requestCount, rateLimitCount, elapsedMs);
        return LingxingTaskResult.success(result);
    }

    static long recommendInterval(long currentIntervalMs, int successCount, int rateLimitCount) {
        if (rateLimitCount > 0) {
            return Math.min(60_000L, currentIntervalMs + 2_000L);
        }
        if (successCount >= 8) {
            return Math.max(5_000L, currentIntervalMs - 500L);
        }
        return currentIntervalMs;
    }

    private String text(JsonNode payload, String field, String defaultValue) {
        if (payload == null || payload.path(field).asText("").isBlank()) return defaultValue;
        return payload.path(field).asText().trim();
    }

    private int boundedInt(JsonNode payload, String field, int defaultValue, int min, int max) {
        int value = payload == null ? defaultValue : payload.path(field).asInt(defaultValue);
        if (value < min || value > max) {
            throw new IllegalArgumentException(field + " 必须在 " + min + "~" + max + " 之间");
        }
        return value;
    }

    private long boundedLong(JsonNode payload, String field, long defaultValue, long min, long max) {
        long value = payload == null ? defaultValue : payload.path(field).asLong(defaultValue);
        if (value < min || value > max) {
            throw new IllegalArgumentException(field + " 必须在 " + min + "~" + max + " 之间");
        }
        return value;
    }
}
