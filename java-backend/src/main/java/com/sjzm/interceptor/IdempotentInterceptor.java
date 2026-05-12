package com.sjzm.interceptor;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sjzm.annotation.Idempotent;
import com.sjzm.common.Result;
import com.sjzm.service.IdempotentService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

import java.lang.reflect.Method;

@Slf4j
public class IdempotentInterceptor implements HandlerInterceptor {

    private final IdempotentService idempotentService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public IdempotentInterceptor(IdempotentService idempotentService) {
        this.idempotentService = idempotentService;
    }

    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        if (!(handler instanceof HandlerMethod)) {
            return true;
        }

        HandlerMethod handlerMethod = (HandlerMethod) handler;
        Method method = handlerMethod.getMethod();

        Idempotent idempotent = method.getAnnotation(Idempotent.class);
        if (idempotent == null) {
            return true;
        }

        String key = buildKey(request, idempotent, handlerMethod);
        int expireTime = idempotent.expireTime();

        boolean acquired = idempotentService.tryLock(key, expireTime);
        if (!acquired) {
            log.warn("幂等性拦截：检测到重复提交, key={}", key);
            writeResponse(response, Result.fail(429, idempotent.message()));
            return false;
        }

        log.debug("幂等性检查通过, key={}", key);
        return true;
    }

    private String buildKey(HttpServletRequest request, Idempotent idempotent, HandlerMethod handlerMethod) {
        String key = idempotent.key();

        if (key.isEmpty()) {
            String methodName = handlerMethod.getMethod().getName();
            String className = handlerMethod.getBeanType().getSimpleName();
            return String.format("%s:%s", className, methodName);
        }

        if (key.contains("#")) {
            key = resolveSpEL(key, handlerMethod, request);
        }

        String uri = request.getRequestURI();
        return String.format("idempotent:%s:%s", uri, key);
    }

    private String resolveSpEL(String spEL, HandlerMethod handlerMethod, HttpServletRequest request) {
        try {
            String paramNames = spEL.replace("#", "");
            return paramNames + "_" + request.getQueryString().hashCode();
        } catch (Exception e) {
            log.warn("SpEL解析失败: {}", e.getMessage());
            return spEL;
        }
    }

    private void writeResponse(HttpServletResponse response, Result<?> result) throws Exception {
        response.setStatus(200);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write(objectMapper.writeValueAsString(result));
    }
}
