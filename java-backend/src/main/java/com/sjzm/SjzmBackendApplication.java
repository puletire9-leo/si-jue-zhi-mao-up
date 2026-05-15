package com.sjzm;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.scheduling.annotation.EnableAsync;

/**
 * 思觉智贸 - 微服务基础骨架
 * 后续新功能拷贝此项目，按模块添加 controller/entity/mapper/service 即可
 */
@SpringBootApplication
@EnableCaching
@EnableAsync
public class SjzmBackendApplication {

    public static void main(String[] args) {
        SpringApplication.run(SjzmBackendApplication.class, args);
    }
}
