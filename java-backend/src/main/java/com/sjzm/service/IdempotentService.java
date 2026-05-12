package com.sjzm.service;

public interface IdempotentService {

    boolean isExecuted(String key);

    boolean tryLock(String key, int expireSeconds);

    void markExecuted(String key, int expireSeconds);

    void markExecuted(String key, int expireSeconds, String value);

    String getExecutedValue(String key);

    void remove(String key);

    boolean tryExecute(String key, int expireSeconds);

    boolean tryExecute(String key, int expireSeconds, String value);
}
