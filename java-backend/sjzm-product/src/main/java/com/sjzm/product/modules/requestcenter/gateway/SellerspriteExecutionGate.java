package com.sjzm.product.modules.requestcenter.gateway;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sjzm.product.entity.CompetitorLookupLog;
import com.sjzm.product.mapper.CompetitorLookupLogMapper;
import com.sjzm.product.modules.requestcenter.gateway.model.SellerspriteExecutionException;
import com.sjzm.product.modules.requestcenter.model.SellerspriteExecutionErrorCode;
import com.sjzm.product.service.ApiRateLimitService;
import lombok.extern.slf4j.Slf4j;
import org.redisson.api.RAtomicLong;
import org.redisson.api.RBucket;
import org.redisson.api.RedissonClient;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Map;

/** 使用 Redis 协调卖家精灵的跨 worker 配额和熔断门禁。 */
@Slf4j
@Component
public class SellerspriteExecutionGate {

    private static final String QUOTA_KEY_PREFIX = "sellersprite:execution:quota:";
    private static final String CIRCUIT_KEY = "sellersprite:execution:circuit";
    /** 上次卖家精灵请求发出时刻（epoch ms），用于强制稳定的最小请求间隔。 */
    private static final String LAST_REQUEST_KEY = "sellersprite:execution:last-request-ms";
    private static final Duration QUOTA_TTL = Duration.ofMinutes(2);
    private static final Duration CIRCUIT_OPEN_DURATION = Duration.ofSeconds(30);
    /** 铁律：卖家精灵请求最小间隔 2 秒，稳定节流，避免突发打满触发限流中断。 */
    private static final long MIN_REQUEST_INTERVAL_MS = 2000L;

    private final RedissonClient redissonClient;
    private final ApiRateLimitService rateLimitService;
    private final CompetitorLookupLogMapper lookupLogMapper;

    public SellerspriteExecutionGate(RedissonClient redissonClient,
                                     ApiRateLimitService rateLimitService,
                                     CompetitorLookupLogMapper lookupLogMapper) {
        this.redissonClient = redissonClient;
        this.rateLimitService = rateLimitService;
        this.lookupLogMapper = lookupLogMapper;
    }

    /** 在任何外部请求前检查全局熔断和配额；失败时请求尚未发出。 */
    public void acquire(int asinCount) {
        checkCircuitOpen();
        if (asinCount > rateLimitService.getMaxAsinsPerRequest()) {
            throw failure(SellerspriteExecutionErrorCode.INVALID_REQUEST,
                    "单次请求最多 " + rateLimitService.getMaxAsinsPerRequest() + " 个 ASIN，当前 " + asinCount,
                    null, null);
        }
        checkMonthlyQuota();
        acquireMinuteQuota();
        enforceMinInterval();
    }

    /**
     * 强制卖家精灵请求间隔至少 {@value #MIN_REQUEST_INTERVAL_MS} 毫秒——稳定节流，避免突发打满触发限流。
     *
     * <p>本方法始终在全局执行锁内被调用（{@code DefaultSellerspriteExecutionGateway.execute} 先拿锁再 acquire），
     * 请求本就串行，故这里 sleep 补足与上次请求的间隔不会造成并发问题。上次时刻记在 Redis，跨实例一致。</p>
     */
    private void enforceMinInterval() {
        try {
            RBucket<String> bucket = redissonClient.getBucket(LAST_REQUEST_KEY);
            String last = bucket.get();
            long now = System.currentTimeMillis();
            if (last != null && !last.isBlank()) {
                long elapsed = now - Long.parseLong(last);
                long wait = MIN_REQUEST_INTERVAL_MS - elapsed;
                if (wait > 0 && wait <= MIN_REQUEST_INTERVAL_MS) {
                    Thread.sleep(wait);
                    now = System.currentTimeMillis();
                }
            }
            // 记录本次请求时刻，TTL 略大于间隔即可，避免长期残留
            bucket.set(String.valueOf(now), Duration.ofSeconds(30));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw failure(SellerspriteExecutionErrorCode.INTERNAL_ERROR,
                    "卖家精灵请求节流等待被中断", LocalDateTime.now().plusSeconds(5), e);
        } catch (SellerspriteExecutionException e) {
            throw e;
        } catch (Exception e) {
            // 节流依赖 Redis，读写失败不应阻断请求，仅记录
            log.warn("卖家精灵请求间隔节流异常(忽略): {}", concise(e));
        }
    }

    public void checkCircuitOpen() {
        try {
            RBucket<String> bucket = redissonClient.getBucket(CIRCUIT_KEY);
            String state = bucket.get();
            if (state == null || state.isBlank()) return;
            String[] parts = state.split("\\|", 2);
            long resumeAtEpochMs = Long.parseLong(parts[0]);
            LocalDateTime resumeAt = LocalDateTime.ofInstant(
                    java.time.Instant.ofEpochMilli(resumeAtEpochMs), java.time.ZoneId.systemDefault());
            if (resumeAt.isAfter(LocalDateTime.now())) {
                String summary = parts.length > 1 ? parts[1] : "卖家精灵熔断门禁开启";
                throw failure(SellerspriteExecutionErrorCode.CIRCUIT_OPEN, summary, resumeAt, null);
            }
            bucket.delete();
        } catch (SellerspriteExecutionException e) {
            throw e;
        } catch (Exception e) {
            throw failure(SellerspriteExecutionErrorCode.INTERNAL_ERROR,
                    "卖家精灵全局门禁不可用: " + concise(e), LocalDateTime.now().plusMinutes(1), e);
        }
    }

    public void openCircuit(String summary) {
        LocalDateTime resumeAt = LocalDateTime.now().plus(CIRCUIT_OPEN_DURATION);
        String value = resumeAt.atZone(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli()
                + "|" + truncate(summary, 400);
        try {
            redissonClient.getBucket(CIRCUIT_KEY).set(value, CIRCUIT_OPEN_DURATION);
            log.warn("卖家精灵全局熔断已开启，预计恢复时间={}, 原因={}", resumeAt, truncate(summary, 200));
        } catch (Exception e) {
            log.error("写入卖家精灵全局熔断门禁失败: {}", concise(e));
        }
    }

    public void clearCircuit() {
        try {
            redissonClient.getBucket(CIRCUIT_KEY).delete();
        } catch (Exception e) {
            log.warn("清理卖家精灵全局熔断门禁失败: {}", concise(e));
        }
    }

    /** 请求中心和前端使用的只读健康快照。 */
    public Map<String, Object> health() {
        Map<String, Object> result = new LinkedHashMap<>(rateLimitService.getQuotaInfo());
        try {
            String state = redissonClient.<String>getBucket(CIRCUIT_KEY).get();
            if (state == null || state.isBlank()) {
                result.put("circuitOpen", false);
                result.put("resumeAt", null);
                result.put("summary", null);
                return result;
            }
            String[] parts = state.split("\\|", 2);
            long epochMs = Long.parseLong(parts[0]);
            LocalDateTime resumeAt = LocalDateTime.ofInstant(java.time.Instant.ofEpochMilli(epochMs), java.time.ZoneId.systemDefault());
            result.put("circuitOpen", resumeAt.isAfter(LocalDateTime.now()));
            result.put("resumeAt", resumeAt);
            result.put("summary", parts.length > 1 ? parts[1] : null);
        } catch (Exception e) {
            result.put("circuitOpen", true);
            result.put("resumeAt", null);
            result.put("summary", "卖家精灵全局门禁状态不可读取: " + concise(e));
        }
        return result;
    }

    private void acquireMinuteQuota() {
        LocalDateTime now = LocalDateTime.now();
        String key = QUOTA_KEY_PREFIX + now.format(DateTimeFormatter.ofPattern("yyyyMMddHHmm"));
        try {
            RAtomicLong counter = redissonClient.getAtomicLong(key);
            long used = counter.incrementAndGet();
            if (used == 1) counter.expire(QUOTA_TTL);
            int max = rateLimitService.getMaxPerMinute();
            if (used <= max) return;
            counter.decrementAndGet();
            LocalDateTime retryAt = now.plusMinutes(1).withSecond(1).withNano(0);
            throw failure(SellerspriteExecutionErrorCode.RATE_LIMIT,
                    "卖家精灵全局分钟配额已达上限 " + max, retryAt, null);
        } catch (SellerspriteExecutionException e) {
            throw e;
        } catch (Exception e) {
            throw failure(SellerspriteExecutionErrorCode.INTERNAL_ERROR,
                    "卖家精灵全局配额门禁不可用: " + concise(e), LocalDateTime.now().plusMinutes(1), e);
        }
    }

    private void checkMonthlyQuota() {
        LocalDateTime monthStart = YearMonth.now().atDay(1).atStartOfDay();
        try {
            Long used = lookupLogMapper.selectCount(new LambdaQueryWrapper<CompetitorLookupLog>()
                    .ge(CompetitorLookupLog::getCreatedAt, monthStart)
                    .eq(CompetitorLookupLog::getUsageConfirmed, true));
            int max = rateLimitService.getMaxPerMonth();
            if (used != null && used >= max) {
                throw failure(SellerspriteExecutionErrorCode.RATE_LIMIT,
                        "本月卖家精灵已确认使用次数达到上限 " + max,
                        monthStart.plusMonths(1), null);
            }
        } catch (SellerspriteExecutionException e) {
            throw e;
        } catch (Exception e) {
            throw failure(SellerspriteExecutionErrorCode.INTERNAL_ERROR,
                    "卖家精灵月度配额校验失败: " + concise(e), LocalDateTime.now().plusMinutes(1), e);
        }
    }

    private SellerspriteExecutionException failure(SellerspriteExecutionErrorCode code, String message,
                                                   LocalDateTime retryAt, Throwable cause) {
        return new SellerspriteExecutionException(code, message, false, false, retryAt, cause);
    }

    private String concise(Throwable e) {
        return e.getMessage() == null ? e.getClass().getSimpleName() : truncate(e.getMessage(), 180);
    }

    private String truncate(String value, int maxLength) {
        if (value == null) return "";
        return value.length() <= maxLength ? value : value.substring(0, maxLength);
    }
}
