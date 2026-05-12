package com.sjzm.filter;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.util.ContentCachingResponseWrapper;

import java.io.IOException;

@Slf4j
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class GatewayFilter implements Filter {

    @Override
    public void init(FilterConfig filterConfig) {
        log.info("[GatewayFilter] 网关过滤器初始化");
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        
        HttpServletRequest httpRequest = (HttpServletRequest) request;
        HttpServletResponse httpResponse = (HttpServletResponse) response;

        String requestId = httpRequest.getHeader("X-Request-Id");
        if (requestId == null || requestId.isEmpty()) {
            requestId = java.util.UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        }
        httpResponse.setHeader("X-Request-Id", requestId);

        httpResponse.setHeader("X-Response-Time", String.valueOf(System.currentTimeMillis()));

        httpResponse.setHeader("Access-Control-Allow-Origin", "*");
        httpResponse.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
        httpResponse.setHeader("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization, X-Request-Id, X-Trace-Id");
        httpResponse.setHeader("Access-Control-Max-Age", "3600");
        httpResponse.setHeader("X-Content-Type-Options", "nosniff");
        httpResponse.setHeader("X-Frame-Options", "DENY");
        httpResponse.setHeader("X-XSS-Protection", "1; mode=block");

        String method = httpRequest.getMethod();
        String uri = httpRequest.getRequestURI();
        String clientIp = getClientIp(httpRequest);

        log.debug("[Gateway] {} {} from {} [requestId={}]", method, uri, clientIp, requestId);

        long startTime = System.currentTimeMillis();
        
        ContentCachingResponseWrapper responseWrapper = new ContentCachingResponseWrapper(httpResponse);
        
        try {
            chain.doFilter(httpRequest, responseWrapper);
        } finally {
            long duration = System.currentTimeMillis() - startTime;
            int status = httpResponse.getStatus();
            
            log.info("[Gateway] {} {} -> {} ({}ms) [requestId={}]", 
                    method, uri, status, duration, requestId);
            
            httpResponse.setHeader("X-Response-Time", String.valueOf(duration));
            responseWrapper.copyBodyToResponse();
        }
    }

    @Override
    public void destroy() {
        log.info("[GatewayFilter] 网关过滤器销毁");
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
