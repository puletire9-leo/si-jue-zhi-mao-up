package com.sjzm.annotation;

import java.lang.annotation.*;

@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface Idempotent {

    String key() default "";

    int expireTime() default 60;

    String message() default "请勿重复提交";

    IdempotentType type() default IdempotentType.DEFAULT;

    enum IdempotentType {
        DEFAULT,
        TOKEN,
        SPEL
    }
}
