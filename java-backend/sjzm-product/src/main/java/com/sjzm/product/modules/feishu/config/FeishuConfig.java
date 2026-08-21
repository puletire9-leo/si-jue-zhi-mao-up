package com.sjzm.product.modules.feishu.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

/**
 * 飞书开放平台配置。
 * AppId/AppSecret 默认从环境变量注入（config/secrets/*.env: FEISHU_APP_ID / FEISHU_APP_SECRET），
 * 运行时可被 api_config 表覆盖（见 FeishuConfigService），仿领星模式。
 *
 * <p>凭证总账另存于 RDS system_config 表（category=feishu），此处 env 为服务运行时来源。
 */
@Data
@Configuration
@ConfigurationProperties(prefix = "feishu")
public class FeishuConfig {

    /** 飞书开放平台域名（国内 feishu） */
    private String baseUrl = "https://open.feishu.cn";

    /** 自建应用 App ID */
    private String appId;

    /** 自建应用 App Secret */
    private String appSecret;

    private Duration connectTimeout = Duration.ofSeconds(10);
    private Duration readTimeout = Duration.ofSeconds(30);
}
