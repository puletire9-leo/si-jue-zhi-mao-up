package com.sjzm.product.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

@Data
@Configuration
@ConfigurationProperties(prefix = "sellersprite")
public class SellerspriteConfig {

    private String apiUrl = "https://api.sellersprite.com/v1";
    private String secretKey;
    private Duration connectTimeout = Duration.ofSeconds(10);
    private Duration readTimeout = Duration.ofSeconds(30);

    private RateLimit rateLimit = new RateLimit();

    @Data
    public static class RateLimit {
        /** 每分钟最大请求次数 */
        private int maxPerMinute = 40;
        /** 每月最大请求次数 */
        private int maxPerMonth = 20000;
        /** 单次请求最大 ASIN 数 */
        private int maxAsinsPerRequest = 40;
    }
}
