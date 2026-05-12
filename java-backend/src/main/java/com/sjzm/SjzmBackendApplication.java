package com.sjzm;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.scheduling.annotation.EnableAsync;

/**
 * 思觉智贸 - 跨境电商产品管理系统 Java 后端启动类
 */
@SpringBootApplication
@MapperScan("com.sjzm.mapper")
@EnableCaching
@EnableAsync
public class SjzmBackendApplication {

    public static void main(String[] args) {
        SpringApplication.run(SjzmBackendApplication.class, args);
    }
}
