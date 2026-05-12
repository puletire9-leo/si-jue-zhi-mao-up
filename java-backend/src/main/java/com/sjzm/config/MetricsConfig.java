package com.sjzm.config;

import io.micrometer.core.aop.TimedAspect;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Tag;
import io.micrometer.core.instrument.Tags;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.actuate.autoconfigure.metrics.MeterRegistryCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.List;

@Configuration
public class MetricsConfig {

    @Value("${spring.application.name:sjzm-backend}")
    private String applicationName;

    @Bean
    public MeterRegistryCustomizer<MeterRegistry> metricsCommonTags() {
        return registry -> registry.config()
                .commonTags("application", applicationName)
                .commonTags("environment", "${SPRING_PROFILES_ACTIVE:dev}")
                .commonTags("region", "${REGION:default}");
    }

    @Bean
    public TimedAspect timedAspect(MeterRegistry registry) {
        return new TimedAspect(registry);
    }

    @Bean
    public RestTemplate restTemplate() {
        return new RestTemplate();
    }

    @Bean
    public MetricsService metricsService(MeterRegistry registry) {
        return new MetricsService(registry);
    }

    public static class MetricsService {
        private final MeterRegistry registry;

        public MetricsService(MeterRegistry registry) {
            this.registry = registry;
        }

        public void recordRequest(String endpoint, long durationMs) {
            registry.timer("http.server.requests",
                    Tags.of("endpoint", endpoint, "status", "success"))
                    .record(java.time.Duration.ofMillis(durationMs));
        }

        public void recordCacheHit(String cacheName) {
            registry.counter("cache.hit", "cache", cacheName).increment();
        }

        public void recordCacheMiss(String cacheName) {
            registry.counter("cache.miss", "cache", cacheName).increment();
        }

        public void recordMqMessage(String queue, String operation) {
            registry.counter("mq.message", "queue", queue, "operation", operation).increment();
        }

        public void recordDbQuery(String operation, long durationMs) {
            registry.timer("db.query", "operation", operation)
                    .record(java.time.Duration.ofMillis(durationMs));
        }
    }
}
