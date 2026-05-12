package com.sjzm.aspect;

import com.sjzm.annotation.TraceOperation;
import com.sjzm.interceptor.TraceInterceptor;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.Arrays;

@Slf4j
@Aspect
@Component
public class TraceAspect {

    @Around("@annotation(traceOperation)")
    public Object around(ProceedingJoinPoint joinPoint, TraceOperation traceOperation) throws Throwable {
        String traceId = getTraceId();
        String methodName = joinPoint.getSignature().getName();
        String className = joinPoint.getTarget().getClass().getSimpleName();
        String operation = traceOperation.operation().isEmpty() ? methodName : traceOperation.operation();
        String module = traceOperation.module();

        long startTime = System.currentTimeMillis();
        log.info("[Trace-AOP] {} - {}#{} 开始执行", traceId, className, methodName);

        if (traceOperation.recordParams()) {
            Object[] args = joinPoint.getArgs();
            log.debug("[Trace-AOP] {} - 参数: {}", traceId, Arrays.toString(args));
        }

        try {
            Object result = joinPoint.proceed();
            long duration = System.currentTimeMillis() - startTime;

            if (traceOperation.recordResult() && result != null) {
                log.debug("[Trace-AOP] {} - 结果: {}", traceId, result.toString());
            }

            log.info("[Trace-AOP] {} - {}#{} 执行完成, 耗时: {}ms",
                    traceId, className, methodName, duration);

            return result;
        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            log.error("[Trace-AOP] {} - {}#{} 执行失败, 耗时: {}ms, 错误: {}",
                    traceId, className, methodName, duration, e.getMessage());
            throw e;
        }
    }

    private String getTraceId() {
        try {
            ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attributes != null) {
                HttpServletRequest request = attributes.getRequest();
                Object traceId = request.getAttribute(TraceInterceptor.TRACE_ID_ATTRIBUTE);
                if (traceId != null) {
                    return traceId.toString();
                }
            }
        } catch (Exception ignored) {
        }
        return "no-trace";
    }
}
