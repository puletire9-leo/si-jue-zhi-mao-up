package com.sjzm.config;

import com.google.common.util.concurrent.RateLimiter;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 三级限流配置（全局/API/IP）
 */
@Slf4j
@Component
public class RateLimitConfig {

    @Value("${app.rate-limit.global-qps:500}")
    private double globalQps;

    @Value("${app.rate-limit.api-qps:100}")
    private double apiQps;

    @Value("${app.rate-limit.ip-qps:30}")
    private double ipQps;

    /** 全局限流器 */
    private final RateLimiter globalRateLimiter;

    /** API 级别限流器 */
    private final Map<String, RateLimiter> apiRateLimiters = new ConcurrentHashMap<>();

    /** IP 级别限流器 */
    private final Map<String, RateLimiter> ipRateLimiters = new ConcurrentHashMap<>();

    public RateLimitConfig() {
        this.globalRateLimiter = RateLimiter.create(500);
    }

    /**
     * 尝试获取全局令牌
     */
    public boolean tryAcquireGlobal() {
        return globalRateLimiter.tryAcquire();
    }

    /**
     * 尝试获取 API 令牌
     */
    public boolean tryAcquireApi(String apiPath) {
        RateLimiter limiter = apiRateLimiters.computeIfAbsent(apiPath, k -> RateLimiter.create(apiQps));
        return limiter.tryAcquire();
    }

    /**
     * 尝试获取 IP 令牌
     */
    public boolean tryAcquireIp(String ip) {
        RateLimiter limiter = ipRateLimiters.computeIfAbsent(ip, k -> RateLimiter.create(ipQps));
        return limiter.tryAcquire();
    }

    /**
     * 获取客户端 IP
     */
    public String getClientIp(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("X-Real-IP");
        }
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getRemoteAddr();
        }
        // 多级代理时取第一个 IP
        if (ip != null && ip.contains(",")) {
            ip = ip.split(",")[0].trim();
        }
        return ip;
    }
}
