package com.sjzm.annotation;

import java.lang.annotation.*;

@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface TraceOperation {

    String value() default "";

    String module() default "";

    String operation() default "";

    boolean recordParams() default false;

    boolean recordResult() default false;
}
