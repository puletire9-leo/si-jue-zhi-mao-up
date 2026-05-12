package com.sjzm.service;

import com.github.benmanes.caffeine.cache.Cache;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

@Slf4j
@Service
public class MultiLevelCacheService {

    @Autowired
    @Qualifier("productCache")
    private Cache<String, Object> caffeineCache;

    @Autowired
    private StringRedisTemplate stringRedisTemplate;

    private static final String CACHE_KEY_PREFIX = "cache:";
    private static final String LOCK_KEY_PREFIX = "lock:";

    public Object get(String key, Class<?> returnType) {
        Object result = null;

        if (result == null) {
            result = getFromLocalCache(key);
        }

        if (result == null) {
            result = getFromRedisCache(key, returnType);
        }

        return result;
    }

    public void put(String key, Object value, int localExpireSeconds, int redisExpireSeconds) {
        putToLocalCache(key, value, localExpireSeconds);
        putToRedisCache(key, value, redisExpireSeconds);
    }

    public void evict(String key) {
        evictLocalCache(key);
        evictRedisCache(key);
    }

    public boolean tryLock(String key, int expireSeconds) {
        String lockKey = LOCK_KEY_PREFIX + key;
        Boolean result = stringRedisTemplate.opsForValue()
                .setIfAbsent(lockKey, "1", expireSeconds, TimeUnit.SECONDS);
        return Boolean.TRUE.equals(result);
    }

    public void unlock(String key) {
        String lockKey = LOCK_KEY_PREFIX + key;
        stringRedisTemplate.delete(lockKey);
    }

    private Object getFromLocalCache(String key) {
        try {
            return caffeineCache.getIfPresent(key);
        } catch (Exception e) {
            log.warn("本地缓存读取失败: key={}, error={}", key, e.getMessage());
            return null;
        }
    }

    private void putToLocalCache(String key, Object value, int expireSeconds) {
        try {
            if (expireSeconds > 0) {
                caffeineCache.put(key, value);
            }
        } catch (Exception e) {
            log.warn("本地缓存写入失败: key={}, error={}", key, e.getMessage());
        }
    }

    private void evictLocalCache(String key) {
        try {
            caffeineCache.invalidate(key);
        } catch (Exception e) {
            log.warn("本地缓存删除失败: key={}, error={}", key, e.getMessage());
        }
    }

    private Object getFromRedisCache(String key, Class<?> returnType) {
        try {
            String redisKey = CACHE_KEY_PREFIX + key;
            String value = stringRedisTemplate.opsForValue().get(redisKey);
            if (value != null && returnType != null) {
                return convertValue(value, returnType);
            }
            return value;
        } catch (Exception e) {
            log.warn("Redis缓存读取失败: key={}, error={}", key, e.getMessage());
            return null;
        }
    }

    private void putToRedisCache(String key, Object value, int expireSeconds) {
        try {
            String redisKey = CACHE_KEY_PREFIX + key;
            String strValue = value instanceof String ? (String) value : value.toString();
            if (expireSeconds > 0) {
                stringRedisTemplate.opsForValue().set(redisKey, strValue, expireSeconds, TimeUnit.SECONDS);
            }
        } catch (Exception e) {
            log.warn("Redis缓存写入失败: key={}, error={}", key, e.getMessage());
        }
    }

    private void evictRedisCache(String key) {
        try {
            String redisKey = CACHE_KEY_PREFIX + key;
            stringRedisTemplate.delete(redisKey);
        } catch (Exception e) {
            log.warn("Redis缓存删除失败: key={}, error={}", key, e.getMessage());
        }
    }

    private Object convertValue(String value, Class<?> type) {
        if (type == String.class) {
            return value;
        } else if (type == Integer.class || type == int.class) {
            return Integer.parseInt(value);
        } else if (type == Long.class || type == long.class) {
            return Long.parseLong(value);
        } else if (type == Boolean.class || type == boolean.class) {
            return Boolean.parseBoolean(value);
        } else if (type == Double.class || type == double.class) {
            return Double.parseDouble(value);
        }
        return value;
    }

    public void clearLocalCache() {
        try {
            caffeineCache.invalidateAll();
        } catch (Exception e) {
            log.warn("清空本地缓存失败: {}", e.getMessage());
        }
    }

    public void clearAllCache() {
        clearLocalCache();
        try {
            stringRedisTemplate.delete(stringRedisTemplate.keys(CACHE_KEY_PREFIX + "*"));
        } catch (Exception e) {
            log.warn("清空Redis缓存失败: {}", e.getMessage());
        }
    }
}
