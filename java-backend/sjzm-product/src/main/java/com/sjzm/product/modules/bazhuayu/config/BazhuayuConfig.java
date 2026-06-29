package com.sjzm.product.modules.bazhuayu.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

/**
 * 八爪鱼开放平台配置。
 * 账号密码默认从环境变量注入（config/secrets/prod.env），
 * 运行时可被 api_config 表覆盖（见 BazhuayuConfigService）。
 */
@Data
@Configuration
@ConfigurationProperties(prefix = "bazhuayu")
public class BazhuayuConfig {

    private String baseUrl = "https://openapi.bazhuayu.com";

    /** 八爪鱼登录账号（用户名/邮箱/手机号） */
    private String username;

    /** 八爪鱼登录密码 */
    private String password;

    private Duration connectTimeout = Duration.ofSeconds(10);
    private Duration readTimeout = Duration.ofSeconds(30);

    /** 云采集状态轮询间隔（秒），文档要求 statuses/v2 最快 1s5 次 */
    private int statusPollIntervalSeconds = 5;

    /** 云采集最长等待（分钟），超时放弃本站点 */
    private int extractionTimeoutMinutes = 60;

    /** data/all 单页拉取条数，范围 1~1000 */
    private int dataPageSize = 1000;

    /**
     * 单次 drain（notexported 增量拉取）最多处理行数，防失控。
     * 0 = 不限（首次清 192 万历史积压时可设大或设 0）。
     */
    private int drainMaxRows = 100000;

    /**
     * 任务组→站点→任务ID 映射(JSON)，配置文件兜底，DB(api_config)可运行时覆盖。
     * 形如 {"<groupId>":{"US":"<taskId>","UK":"<taskId>","DE":"<taskId>"}}
     */
    private String taskMappingJson = "";
}
