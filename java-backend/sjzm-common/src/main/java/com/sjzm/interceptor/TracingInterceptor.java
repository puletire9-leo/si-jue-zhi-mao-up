package com.sjzm.interceptor;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.ModelAndView;

import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Slf4j
@Component
@RequiredArgsConstructor
public class TracingInterceptor implements HandlerInterceptor {

    public static final String TRACE_ID_HEADER = "X-Trace-Id";
    public static final String SPAN_ID_HEADER = "X-Span-Id";
    public static final String TRACE_ID_ATTRIBUTE = "traceId";
    public static final String REQUEST_START_TIME = "requestStartTime";
    public static final String REQUEST_TIMER = "requestTimer";

    private final MeterRegistry meterRegistry;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        String traceId = request.getHeader(TRACE_ID_HEADER);
        if (traceId == null || traceId.isEmpty()) {
            traceId = UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        }

        String spanId = UUID.randomUUID().toString().replace("-", "").substring(0, 8);

        request.setAttribute(TRACE_ID_ATTRIBUTE, traceId);
        request.setAttribute(REQUEST_START_TIME, System.currentTimeMillis());

        response.setHeader(TRACE_ID_HEADER, traceId);
        response.setHeader(SPAN_ID_HEADER, spanId);

        String method = request.getMethod();
        String uri = normalizeUri(request.getRequestURI());
        String clientIp = getClientIp(request);

        log.info("[Trace] 开始处理请求: traceId={}, method={}, uri={}, remoteAddr={}",
                traceId, method, uri, clientIp);

        Timer.Sample sample = Timer.start(meterRegistry);
        request.setAttribute(REQUEST_TIMER, sample);

        meterRegistry.counter("http.requests",
                "method", method,
                "uri", uri,
                "status", "started").increment();

        return true;
    }

    @Override
    public void postHandle(HttpServletRequest request, HttpServletResponse response, Object handler, ModelAndView modelAndView) {
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
        String traceId = (String) request.getAttribute(TRACE_ID_ATTRIBUTE);
        Long startTime = (Long) request.getAttribute(REQUEST_START_TIME);
        Timer.Sample sample = (Timer.Sample) request.getAttribute(REQUEST_TIMER);

        long duration = startTime != null ? System.currentTimeMillis() - startTime : 0;
        String method = request.getMethod();
        String uri = normalizeUri(request.getRequestURI());
        int status = response.getStatus();

        if (sample != null) {
            sample.stop(meterRegistry.timer("http.server.requests",
                    "method", method,
                    "uri", uri,
                    "status", String.valueOf(status),
                    "outcome", status >= 500 ? "ERROR" : status >= 400 ? "WARNING" : "SUCCESS"));
        }

        String logLevel = status >= 500 ? "ERROR" : status >= 400 ? "WARN" : "INFO";

        if (ex != null) {
            log.error("[Trace] 请求处理异常: traceId={}, method={}, uri={}, duration={}ms, error={}",
                    traceId, method, uri, duration, ex.getMessage(), ex);
            meterRegistry.counter("http.errors",
                    "method", method,
                    "uri", uri,
                    "type", ex.getClass().getSimpleName()).increment();
        } else {
            log.info("[Trace] 请求处理完成: traceId={}, method={}, uri={}, status={}, duration={}ms",
                    traceId, method, uri, status, duration);
        }
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

    private String normalizeUri(String uri) {
        if (uri == null) return "/";
        return uri.replaceAll("/\\d+", "/{id}")
                  .replaceAll("/[a-f0-9-]{36}", "/{uuid}");
    }
}
