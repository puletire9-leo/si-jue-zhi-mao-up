package com.sjzm.product.modules.automation.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * 财务日报飞书目标配置（app token + 5 张数据表 ID）。
 *
 * <p>app token / table id 一律从环境变量注入，禁止硬编码：
 * FINANCE_DAILY_REPORT_FEISHU_APP_TOKEN / FINANCE_DAILY_REPORT_TABLE_*。</p>
 *
 * <p>5 张表对应最终日报的 5 个维度：
 * 总 / 运营 / 开发 / 非标品 / 上架时间。</p>
 */
@Data
@Configuration
@ConfigurationProperties(prefix = "automation.finance-daily-report")
public class FinanceDailyReportConfig {

    /** 飞书多维表格 app token（base token） */
    private String feishuAppToken;

    /** 总维度数据表 ID */
    private String feishuTableTotal;

    /** 运营维度数据表 ID */
    private String feishuTableOperations;

    /** 开发维度数据表 ID */
    private String feishuTableDeveloper;

    /** 非标品维度数据表 ID */
    private String feishuTableNonstandard;

    /** 上架时间维度数据表 ID */
    private String feishuTableListingTime;
}
