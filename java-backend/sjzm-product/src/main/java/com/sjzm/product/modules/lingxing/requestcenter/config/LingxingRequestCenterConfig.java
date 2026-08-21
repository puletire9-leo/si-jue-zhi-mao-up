package com.sjzm.product.modules.lingxing.requestcenter.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.ThreadPoolExecutor;

/**
 * 领星请求中心执行器配置。
 *
 * <p>单线程执行器：核心/最大线程数固定为 1，队列容量通过
 * {@code LINGXING_REQUEST_QUEUE_CAPACITY}（默认 1000）配置。配合
 * {@link com.sjzm.product.modules.lingxing.service.LingxingClient} 的账号级串行化门禁，
 * 保证领星开放平台按令牌桶=1 串行调用，不跨任务并发。</p>
 */
@Configuration
public class LingxingRequestCenterConfig {

    @Value("${lingxing.request.queue-capacity:1000}")
    private int queueCapacity;

    @Bean("lingxingRequestExecutor")
    public ThreadPoolTaskExecutor lingxingRequestExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(1);
        executor.setMaxPoolSize(1);
        executor.setQueueCapacity(Math.max(1, queueCapacity));
        executor.setThreadNamePrefix("lingxing-request-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(120);
        executor.initialize();
        return executor;
    }
}
