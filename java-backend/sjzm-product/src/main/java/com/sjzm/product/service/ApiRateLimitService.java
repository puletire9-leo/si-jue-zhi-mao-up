package com.sjzm.product.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sjzm.common.BusinessException;
import com.sjzm.product.config.SellerspriteConfig;
import com.sjzm.product.entity.ApiConfig;
import com.sjzm.product.mapper.ApiConfigMapper;
import com.sjzm.product.mapper.CompetitorLookupLogMapper;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

@Slf4j
@Service
@RequiredArgsConstructor
public class ApiRateLimitService {

    private final SellerspriteConfig config;
    private final CompetitorLookupLogMapper logMapper;
    private final ApiConfigMapper apiConfigMapper;

    private final AtomicInteger minuteCounter = new AtomicInteger(0);
    private final AtomicLong minuteWindowStart = new AtomicLong(System.currentTimeMillis());

    // 运行时动态上限（可从 API 修改，持久化到 DB）
    private final AtomicInteger dynamicMaxPerMinute = new AtomicInteger(-1);
    private final AtomicInteger dynamicMaxPerMonth = new AtomicInteger(-1);
    private final AtomicInteger dynamicMaxAsinsPerRequest = new AtomicInteger(-1);

    @PostConstruct
    public void init() {
        loadDynamicConfig();
    }

    /** 从 DB 加载动态配置 */
    private void loadDynamicConfig() {
        try {
            java.util.List<ApiConfig> configs = apiConfigMapper.selectList(null);
            for (ApiConfig c : configs) {
                try {
                    int val = Integer.parseInt(c.getConfigValue());
                    switch (c.getConfigKey()) {
                        case "max_per_minute" -> dynamicMaxPerMinute.set(val);
                        case "max_per_month" -> dynamicMaxPerMonth.set(val);
                        case "max_asins_per_request" -> dynamicMaxAsinsPerRequest.set(val);
                    }
                } catch (NumberFormatException ignored) {}
            }
            log.info("已加载动态配置: maxPerMinute={}, maxPerMonth={}, maxAsins={}",
                    getMaxPerMinute(), getMaxPerMonth(), getMaxAsinsPerRequest());
        } catch (Exception e) {
            log.warn("加载动态配置失败，使用 YAML 默认值: {}", e.getMessage());
        }
    }

    /** 持久化并生效新的上限值 */
    public void updateMaxPerMinute(int value) {
        saveConfig("max_per_minute", String.valueOf(value), "每分钟最大请求次数");
        dynamicMaxPerMinute.set(value);
    }

    public void updateMaxPerMonth(int value) {
        saveConfig("max_per_month", String.valueOf(value), "每月最大请求次数");
        dynamicMaxPerMonth.set(value);
    }

    public void updateMaxAsinsPerRequest(int value) {
        saveConfig("max_asins_per_request", String.valueOf(value), "单次最大 ASIN 数");
        dynamicMaxAsinsPerRequest.set(value);
    }

    private void saveConfig(String key, String value, String desc) {
        try {
            ApiConfig existing = apiConfigMapper.selectOne(
                    new LambdaQueryWrapper<ApiConfig>().eq(ApiConfig::getConfigKey, key));
            if (existing != null) {
                existing.setConfigValue(value);
                apiConfigMapper.updateById(existing);
            } else {
                ApiConfig c = new ApiConfig();
                c.setConfigKey(key);
                c.setConfigValue(value);
                c.setDescription(desc);
                apiConfigMapper.insert(c);
            }
        } catch (Exception e) {
            log.warn("持久化配置 {} 失败: {}", key, e.getMessage());
        }
    }

    // ---- 实际取值：DB 覆盖 > YAML 默认 ----

    public int getMaxPerMinute() {
        int v = dynamicMaxPerMinute.get();
        return v > 0 ? v : config.getRateLimit().getMaxPerMinute();
    }

    public int getMaxPerMonth() {
        int v = dynamicMaxPerMonth.get();
        return v > 0 ? v : config.getRateLimit().getMaxPerMonth();
    }

    public int getMaxAsinsPerRequest() {
        int v = dynamicMaxAsinsPerRequest.get();
        return v > 0 ? v : config.getRateLimit().getMaxAsinsPerRequest();
    }

    // ---- 限流检查 ----

    public void checkRateLimit(int asinCount) {
        int maxAsins = getMaxAsinsPerRequest();

        if (asinCount > maxAsins) {
            throw new BusinessException(400,
                    String.format("单次请求最多 %d 个 ASIN，当前 %d 个", maxAsins, asinCount));
        }
        checkRequestQuota();
    }

    public void checkRequestQuota() {
        checkMinuteLimit(getMaxPerMinute());
        checkMonthLimit(getMaxPerMonth());
    }

    private void checkMinuteLimit(int maxPerMinute) {
        while (true) {
            long now = System.currentTimeMillis();
            long windowStart = minuteWindowStart.get();
            if (now - windowStart >= 60_000) {
                synchronized (this) {
                    if (now - minuteWindowStart.get() >= 60_000) {
                        minuteWindowStart.set(now);
                        minuteCounter.set(0);
                    }
                }
            }
            int current = minuteCounter.incrementAndGet();
            if (current <= maxPerMinute) return;

            // 超限：回滚计数，等待窗口重置后重试
            minuteCounter.decrementAndGet();
            long elapsed = System.currentTimeMillis() - minuteWindowStart.get();
            long waitMs = 61_000 - elapsed; // 窗口后多等 1 秒缓冲
            if (waitMs < 1000) waitMs = 1000;
            log.info("每分钟限流 ({}/min)，等待 {}s 后继续...", maxPerMinute, waitMs / 1000);
            try {
                Thread.sleep(waitMs);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new BusinessException(429, "限流等待被中断");
            }
        }
    }

    private void checkMonthLimit(int maxPerMonth) {
        String currentMonth = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMM"));
        Long monthCount = logMapper.selectCount(
                new LambdaQueryWrapper<com.sjzm.product.entity.CompetitorLookupLog>()
                        .ge(com.sjzm.product.entity.CompetitorLookupLog::getCreatedAt,
                                LocalDateTime.of(Integer.parseInt(currentMonth.substring(0, 4)),
                                        Integer.parseInt(currentMonth.substring(4, 6)), 1, 0, 0)));
        if (monthCount != null && monthCount >= maxPerMonth) {
            throw new BusinessException(429,
                    String.format("本月 API 请求已达上限 %d 次，请下月再试", maxPerMonth));
        }
    }

    // ---- 配额查询 ----

    public int getMinuteUsed() { return minuteCounter.get(); }
    public int getMinuteRemaining() { return Math.max(0, getMaxPerMinute() - minuteCounter.get()); }
    public long getMinuteWindowElapsedSeconds() {
        return (System.currentTimeMillis() - minuteWindowStart.get()) / 1000;
    }
    public Long getMonthUsed() {
        String currentMonth = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMM"));
        return logMapper.selectCount(
                new LambdaQueryWrapper<com.sjzm.product.entity.CompetitorLookupLog>()
                        .ge(com.sjzm.product.entity.CompetitorLookupLog::getCreatedAt,
                                LocalDateTime.of(Integer.parseInt(currentMonth.substring(0, 4)),
                                        Integer.parseInt(currentMonth.substring(4, 6)), 1, 0, 0)));
    }

    public Map<String, Object> getQuotaInfo() {
        int maxMin = getMaxPerMinute();
        int maxMon = getMaxPerMonth();
        int usedMin = getMinuteUsed();
        long usedMon = getMonthUsed();
        return Map.of(
                "minuteUsed", usedMin,
                "minuteRemaining", Math.max(0, maxMin - usedMin),
                "maxPerMinute", maxMin,
                "monthUsed", usedMon,
                "monthRemaining", Math.max(0, maxMon - (int) usedMon),
                "maxPerMonth", maxMon,
                "maxAsinsPerRequest", getMaxAsinsPerRequest()
        );
    }
}
