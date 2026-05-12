package com.sjzm.config;

import com.baomidou.dynamic.datasource.annotation.DS;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.lang.reflect.Method;

@Slf4j
@Aspect
@Component
@Order(0)
public class ReadWriteRoutingAspect {

    @Around("execution(* com.sjzm.service..*.get*(..)) || " +
            "execution(* com.sjzm.service..*.find*(..)) || " +
            "execution(* com.sjzm.service..*.query*(..)) || " +
            "execution(* com.sjzm.service..*.list*(..)) || " +
            "execution(* com.sjzm.service..*.count*(..)) || " +
            "execution(* com.sjzm.service..*.select*(..)) || " +
            "execution(* com.sjzm.service..*.search*(..))")
    public Object routeToRead(ProceedingJoinPoint point) throws Throwable {
        MethodSignature signature = (MethodSignature) point.getSignature();
        Method method = signature.getMethod();
        
        if (method.isAnnotationPresent(DS.class)) {
            return point.proceed();
        }
        
        log.debug("[RW-Routing] 路由到从库: {}.{}", 
                point.getTarget().getClass().getSimpleName(), method.getName());
        
        try {
            DynamicRoutingDataSource.setDataSourceKey("slave");
            return point.proceed();
        } finally {
            DynamicRoutingDataSource.clearDataSourceKey();
        }
    }

    @Around("execution(* com.sjzm.service..*.save*(..)) || " +
            "execution(* com.sjzm.service..*.insert*(..)) || " +
            "execution(* com.sjzm.service..*.update*(..)) || " +
            "execution(* com.sjzm.service..*.delete*(..)) || " +
            "execution(* com.sjzm.service..*.remove*(..)) || " +
            "execution(* com.sjzm.service..*.create*(..)) || " +
            "execution(* com.sjzm.service..*.batch*(..))")
    public Object routeToWrite(ProceedingJoinPoint point) throws Throwable {
        MethodSignature signature = (MethodSignature) point.getSignature();
        Method method = signature.getMethod();
        
        if (method.isAnnotationPresent(DS.class)) {
            return point.proceed();
        }
        
        log.debug("[RW-Routing] 路由到主库: {}.{}", 
                point.getTarget().getClass().getSimpleName(), method.getName());
        
        try {
            DynamicRoutingDataSource.setDataSourceKey("master");
            return point.proceed();
        } finally {
            DynamicRoutingDataSource.clearDataSourceKey();
        }
    }
}
