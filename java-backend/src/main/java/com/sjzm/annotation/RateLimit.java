package com.sjzm.annotation;

import java.lang.annotation.*;

@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface RateLimit {

    String key() default "";

    int permitsPerSecond() default 10;

    int timeout() default 0;

    String message() default "请求过于频繁，请稍后重试";
}
