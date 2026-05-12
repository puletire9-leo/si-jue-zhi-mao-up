package com.sjzm.config;

import com.sjzm.interceptor.IdempotentInterceptor;
import com.sjzm.interceptor.TracingInterceptor;
import com.sjzm.service.IdempotentService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Slf4j
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    @Autowired
    private IdempotentService idempotentService;

    @Autowired
    private TracingInterceptor tracingInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(tracingInterceptor)
                .addPathPatterns("/**")
                .excludePathPatterns("/actuator/**");

        IdempotentInterceptor idempotentInterceptor = new IdempotentInterceptor(idempotentService);
        registry.addInterceptor(idempotentInterceptor)
                .addPathPatterns("/api/**")
                .excludePathPatterns(
                        "/api/v1/auth/login",
                        "/api/v1/auth/refresh",
                        "/health",
                        "/actuator/**"
                );

        log.info("Trace拦截器已注册");
        log.info("幂等性拦截器已注册");
    }
}
