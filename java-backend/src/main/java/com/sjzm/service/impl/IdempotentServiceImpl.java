package com.sjzm.service.impl;

import com.sjzm.service.IdempotentService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
public class IdempotentServiceImpl implements IdempotentService {

    private static final String IDEMPOTENT_KEY_PREFIX = "idempotent:";

    @Autowired
    private StringRedisTemplate stringRedisTemplate;

    @Override
    public boolean isExecuted(String key) {
        return Boolean.TRUE.equals(stringRedisTemplate.hasKey(IDEMPOTENT_KEY_PREFIX + key));
    }

    @Override
    public boolean tryLock(String key, int expireSeconds) {
        String fullKey = IDEMPOTENT_KEY_PREFIX + key;
        String value = UUID.randomUUID().toString();
        Boolean result = stringRedisTemplate.opsForValue()
                .setIfAbsent(fullKey, value, expireSeconds, TimeUnit.SECONDS);
        return Boolean.TRUE.equals(result);
    }

    @Override
    public void markExecuted(String key, int expireSeconds) {
        markExecuted(key, expireSeconds, "1");
    }

    @Override
    public void markExecuted(String key, int expireSeconds, String value) {
        String fullKey = IDEMPOTENT_KEY_PREFIX + key;
        stringRedisTemplate.opsForValue().set(fullKey, value, expireSeconds, TimeUnit.SECONDS);
    }

    @Override
    public String getExecutedValue(String key) {
        String fullKey = IDEMPOTENT_KEY_PREFIX + key;
        return stringRedisTemplate.opsForValue().get(fullKey);
    }

    @Override
    public void remove(String key) {
        String fullKey = IDEMPOTENT_KEY_PREFIX + key;
        stringRedisTemplate.delete(fullKey);
    }

    @Override
    public boolean tryExecute(String key, int expireSeconds) {
        return tryExecute(key, expireSeconds, "1");
    }

    @Override
    public boolean tryExecute(String key, int expireSeconds, String value) {
        String fullKey = IDEMPOTENT_KEY_PREFIX + key;
        Boolean result = stringRedisTemplate.opsForValue()
                .setIfAbsent(fullKey, value, expireSeconds, TimeUnit.SECONDS);
        return Boolean.TRUE.equals(result);
    }
}
