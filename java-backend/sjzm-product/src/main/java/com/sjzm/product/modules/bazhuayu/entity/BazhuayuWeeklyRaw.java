package com.sjzm.product.modules.bazhuayu.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 八爪鱼每周原始采集数据。仅保留当前 ISO 周，旧周在采集开始前删除。
 * 见 java-backend/sql/create_bazhuayu_weekly_raw.sql
 */
@Data
@TableName("bazhuayu_weekly_raw")
public class BazhuayuWeeklyRaw {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    /** 站点 UK/DE/US */
    private String marketplace;

    private String asin;

    /** 原始价格文本（含币种符号，初筛阶段再解析） */
    private String price;

    /** 原始评论数文本 */
    private String reviews;

    private String title;

    /** 八爪鱼原始行 JSON（留痕，便于列映射核对） */
    private String rawJson;

    /** ISO 周标记 如 2026-W19 */
    private String weekTag;

    /** 八爪鱼云采集批次号 */
    private String lotNo;

    private LocalDateTime scrapedAt;
}
