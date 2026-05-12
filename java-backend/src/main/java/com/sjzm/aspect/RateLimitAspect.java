package com.sjzm.aspect;

import com.sjzm.annotation.RateLimit;
import com.sjzm.exception.RateLimitExceededException;
import com.google.common.util.concurrent.RateLimiter;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.lang.reflect.Method;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Aspect
@Component
public class RateLimitAspect {

    private final Map<String, RateLimiter> rateLimiterCache = new ConcurrentHashMap<>();

    @Around("@annotation(rateLimit)")
    public Object around(ProceedingJoinPoint point, RateLimit rateLimit) throws Throwable {
        String key = getKey(point, rateLimit);
        RateLimiter rateLimiter = rateLimiterCache.computeIfAbsent(key, 
                k -> RateLimiter.create(rateLimit.permitsPerSecond()));

        if (!rateLimiter.tryAcquire(rateLimit.timeout(), java.util.concurrent.TimeUnit.SECONDS)) {
            log.warn("[RateLimit] 请求被限流: key={}, permits={}/s", 
                    key, rateLimit.permitsPerSecond());
            throw new com.sjzm.exception.RateLimitExceededException(rateLimit.message());
        }

        return point.proceed();
    }

    private String getKey(ProceedingJoinPoint point, RateLimit rateLimit) {
        String customKey = rateLimit.key();
        if (customKey != null && !customKey.isEmpty()) {
            return customKey;
        }

        MethodSignature signature = (MethodSignature) point.getSignature();
        Method method = signature.getMethod();
        String className = point.getTarget().getClass().getSimpleName();
        String methodName = method.getName();

        try {
            ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attributes != null) {
                HttpServletRequest request = attributes.getRequest();
                String clientIp = getClientIp(request);
                return String.format("%s:%s:%s", className, methodName, clientIp);
            }
        } catch (Exception ignored) {
        }

        return String.format("%s:%s", className, methodName);
    }

    private String getClientIp(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("X-Real-IP");
        }
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getRemoteAddr();
        }
        if (ip != null && ip.contains(",")) {
            ip = ip.split(",")[0].trim();
        }
        return ip;
    }
}
