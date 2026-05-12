package com.sjzm.config;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.cache.CacheManager;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import java.util.concurrent.TimeUnit;

@Configuration
public class CaffeineConfig {

    @Bean
    public Cache<String, Object> productCache() {
        return Caffeine.newBuilder()
                .maximumSize(1000)
                .expireAfterWrite(getRandomExpiration(10, 15), TimeUnit.MINUTES)
                .recordStats()
                .build();
    }

    @Bean
    public Cache<String, Object> selectionCache() {
        return Caffeine.newBuilder()
                .maximumSize(2000)
                .expireAfterWrite(getRandomExpiration(5, 8), TimeUnit.MINUTES)
                .recordStats()
                .build();
    }

    @Bean
    public Cache<String, Object> userCache() {
        return Caffeine.newBuilder()
                .maximumSize(500)
                .expireAfterWrite(getRandomExpiration(30, 45), TimeUnit.MINUTES)
                .recordStats()
                .build();
    }

    @Bean
    public Cache<String, Object> categoryCache() {
        return Caffeine.newBuilder()
                .maximumSize(200)
                .expireAfterWrite(getRandomExpiration(60, 90), TimeUnit.MINUTES)
                .recordStats()
                .build();
    }

    @Bean
    public Cache<String, Object> imageProxyCache() {
        return Caffeine.newBuilder()
                .maximumSize(500)
                .expireAfterWrite(getRandomExpiration(60, 90), TimeUnit.MINUTES)
                .recordStats()
                .build();
    }

    @Bean
    @Primary
    public CacheManager caffeineCacheManager() {
        CaffeineCacheManager cacheManager = new CaffeineCacheManager();
        cacheManager.setCaffeine(Caffeine.newBuilder()
                .maximumSize(500)
                .expireAfterWrite(getRandomExpiration(10, 15), TimeUnit.MINUTES)
                .recordStats());
        return cacheManager;
    }

    @Bean("longTermCache")
    public CacheManager longTermCacheManager() {
        CaffeineCacheManager cacheManager = new CaffeineCacheManager();
        cacheManager.setCaffeine(Caffeine.newBuilder()
                .maximumSize(1000)
                .expireAfterWrite(getRandomExpiration(30, 45), TimeUnit.MINUTES)
                .recordStats());
        return cacheManager;
    }

    @Bean("shortTermCache")
    public CacheManager shortTermCacheManager() {
        CaffeineCacheManager cacheManager = new CaffeineCacheManager();
        cacheManager.setCaffeine(Caffeine.newBuilder()
                .maximumSize(2000)
                .expireAfterWrite(getRandomExpiration(1, 2), TimeUnit.MINUTES)
                .recordStats());
        return cacheManager;
    }

    private int getRandomExpiration(int baseMinutes, int maxMinutes) {
        return baseMinutes + (int) (Math.random() * (maxMinutes - baseMinutes));
    }
}
