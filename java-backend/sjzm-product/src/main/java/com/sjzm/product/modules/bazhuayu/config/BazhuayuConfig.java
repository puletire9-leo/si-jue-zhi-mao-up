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
     * 分页拉取翻页间隔（毫秒），避免八爪鱼数据接口 429 限流。
     * 原固定 2000ms 是导入慢的主因（30 万行/1000 每页 = 300 页 × 2s ≈ 10 分钟纯 sleep）。
     * 改为可配：BAZHUAYU_PAGE_DELAY_MS。经测数据接口比采集接口宽松，500ms 通常安全；
     * 若遇 429 再调回 1000~2000。<=0 视为不 sleep（仅内网/自测用，生产勿设 0）。
     */
    private long pageDelayMs = 800;

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
