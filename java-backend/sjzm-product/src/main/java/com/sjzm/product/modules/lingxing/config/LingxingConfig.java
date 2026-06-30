package com.sjzm.product.modules.lingxing.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

/**
 * 领星开放平台配置。
 * AppId/AppSecret 默认从环境变量注入（config/secrets/prod.env），
 * 运行时可被 api_config 表覆盖（见 LingxingConfigService）。
 * 文档：产品数据/领星数据api/文档/领星 API 接入指南。
 */
@Data
@Configuration
@ConfigurationProperties(prefix = "lingxing")
public class LingxingConfig {

    private String baseUrl = "https://openapi.lingxing.com";

    /** 领星 AppId（同时作为 app_key 及签名 AES 密钥） */
    private String appId;

    /** 领星 AppSecret（换 token 用，服务端 RSA 解密） */
    private String appSecret;

    private Duration connectTimeout = Duration.ofSeconds(10);
    private Duration readTimeout = Duration.ofSeconds(30);
}
