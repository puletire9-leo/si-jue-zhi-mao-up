package com.sjzm.annotation;

import java.lang.annotation.*;

@Target({ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface CacheWithMultiLevel {

    String key();

    int localExpireSeconds() default 300;

    int redisExpireSeconds() default 3600;

    boolean enableLocal() default true;

    boolean enableRedis() default true;

    boolean enableBloomFilter() default false;

    Class<?> bloomFilterClass() default Void.class;

    String bloomFilterName() default "defaultBloomFilter";

    String message() default "请求过于频繁，请稍后重试";
}
