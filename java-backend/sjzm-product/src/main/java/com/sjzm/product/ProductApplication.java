package com.sjzm.product;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.context.annotation.Bean;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.ThreadPoolExecutor;

@SpringBootApplication(scanBasePackages = "com.sjzm")
@EnableDiscoveryClient
@EnableFeignClients
@EnableAsync
@EnableScheduling
@MapperScan({
        "com.sjzm.product.mapper",
        "com.sjzm.product.modules.analysisbaseline.shopprofile.mapper",
        "com.sjzm.product.modules.analysisbaseline.productfamily.mapper",
        "com.sjzm.product.modules.analysisbaseline.methodevidence.mapper"
})
public class ProductApplication {

    @Value("${BAZHUAYU_EXECUTOR_CORE:3}")
    private int bazhuayuCore;
    @Value("${BAZHUAYU_EXECUTOR_MAX:6}")
    private int bazhuayuMax;
    @Value("${BAZHUAYU_EXECUTOR_QUEUE:12}")
    private int bazhuayuQueue;

    public static void main(String[] args) {
        SpringApplication.run(ProductApplication.class, args);
    }

    @Bean("sellerImportExecutor")
    public ThreadPoolTaskExecutor sellerImportExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(1);
        executor.setMaxPoolSize(1);
        executor.setQueueCapacity(10);
        executor.setThreadNamePrefix("seller-import-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.initialize();
        return executor;
    }

    /**
     * 八爪鱼采集专用池：6 个任务(榜单×3 + 以图识图×3)可并行。
     * 与 sellerImportExecutor / 默认 taskExecutor 隔离，一条龙长任务不阻塞卖家精灵执行。
     */
    @Bean("bazhuayuExecutor")
    public ThreadPoolTaskExecutor bazhuayuExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(bazhuayuCore);
        executor.setMaxPoolSize(bazhuayuMax);
        executor.setQueueCapacity(bazhuayuQueue);
        executor.setThreadNamePrefix("bazhuayu-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.initialize();
        return executor;
    }
}
