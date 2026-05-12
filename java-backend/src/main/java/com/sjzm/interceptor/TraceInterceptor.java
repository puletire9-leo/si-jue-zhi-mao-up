package com.sjzm.interceptor;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.ModelAndView;

import java.util.UUID;

@Slf4j
@Component
public class TraceInterceptor implements HandlerInterceptor {

    public static final String TRACE_ID_HEADER = "X-Trace-Id";
    public static final String TRACE_ID_ATTRIBUTE = "traceId";
    public static final String REQUEST_START_TIME = "requestStartTime";

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        String traceId = request.getHeader(TRACE_ID_HEADER);
        if (traceId == null || traceId.isEmpty()) {
            traceId = UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        }

        request.setAttribute(TRACE_ID_ATTRIBUTE, traceId);
        request.setAttribute(REQUEST_START_TIME, System.currentTimeMillis());
        response.setHeader(TRACE_ID_HEADER, traceId);

        log.info("[Trace] 开始处理请求: traceId={}, method={}, uri={}, remoteAddr={}",
                traceId, request.getMethod(), request.getRequestURI(), getClientIp(request));

        return true;
    }

    @Override
    public void postHandle(HttpServletRequest request, HttpServletResponse response, Object handler, ModelAndView modelAndView) {
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
        String traceId = (String) request.getAttribute(TRACE_ID_ATTRIBUTE);
        Long startTime = (Long) request.getAttribute(REQUEST_START_TIME);
        long duration = startTime != null ? System.currentTimeMillis() - startTime : 0;

        int status = response.getStatus();
        String logLevel = status >= 500 ? "ERROR" : status >= 400 ? "WARN" : "INFO";

        if (ex != null) {
            log.error("[Trace] 请求处理异常: traceId={}, method={}, uri={}, duration={}ms, error={}",
                    traceId, request.getMethod(), request.getRequestURI(), duration, ex.getMessage(), ex);
        } else {
            log.info("[Trace] 请求处理完成: traceId={}, method={}, uri={}, status={}, duration={}ms",
                    traceId, request.getMethod(), request.getRequestURI(), status, duration);
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
}
