package com.sjzm.annotation;

import java.lang.annotation.*;

@Target({ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface CacheEvictWithMultiLevel {

    String key();

    boolean evictLocal() default true;

    boolean evictRedis() default true;

    boolean evictBloomFilter() default false;

    Class<?> bloomFilterClass() default Void.class;
}
