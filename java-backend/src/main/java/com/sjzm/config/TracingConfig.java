package com.sjzm.config;

import io.micrometer.tracing.Span;
import io.micrometer.tracing.Tracer;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

@Slf4j
@Configuration
@RequiredArgsConstructor
public class TracingConfig {

    private final Tracer tracer;

    @Bean
    public RestTemplate restTemplate() {
        return new RestTemplate();
    }

    public void createSpan(String name, Runnable action) {
        Span span = tracer.nextSpan().name(name).start();
        try (Tracer.SpanInScope spanInScope = tracer.withSpan(span)) {
            action.run();
        } finally {
            span.end();
        }
    }

    public <T> T createSpan(String name, java.util.concurrent.Callable<T> action) throws Exception {
        Span span = tracer.nextSpan().name(name).start();
        try (Tracer.SpanInScope spanInScope = tracer.withSpan(span)) {
            return action.call();
        } finally {
            span.end();
        }
    }
}
