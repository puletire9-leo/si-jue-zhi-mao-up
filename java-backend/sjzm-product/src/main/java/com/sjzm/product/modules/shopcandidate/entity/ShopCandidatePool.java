package com.sjzm.product.modules.shopcandidate.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 店铺候选池：记录"某一批、某个方法卡、某个原因下，这家店为什么可能值得抓"。
 *
 * <p>方法卡命中只落候选池（不直接写观察池），人工确认后才触发卖家精灵 API 抓店铺全集。
 * 同一家店在同一周同一方法卡只保留一条候选（uk_candidate_source）。</p>
 */
@Data
@TableName("shop_candidate_pool")
public class ShopCandidatePool {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 站点：UK / DE / US */
    private String marketplace;

    /** 店铺名 */
    private String sellerName;

    /** 店铺 ID，可为空 */
    private String sellerId;

    /** 来源类型：METHOD_CARD / BASELINE / MANUAL / CATEGORY / OWN_GOOD_SIMILAR */
    private String sourceType;

    /** 来源编码：M01 / M03 / ZHENG_UK_DE 等 */
    private String sourceCode;

    /** ISO 周批次 yyyy-Www（WeekTagUtil 生成） */
    private String batchCode;

    /** 数据批次日期 yyyyMMdd */
    private String batchDate;

    /** 入池原因，前端必须展示 */
    private String reason;

    /** 方法卡命中商品数（父体去重后） */
    private Integer hitCount;

    /** 主命中类目 */
    private String topCategory;

    /** 命中商品 A/B/C/D 摘要 JSON */
    private String salesTierSummaryJson;

    /** 命中商品样例 JSON：图片/ASIN/标题/类目 */
    private String sampleProductsJson;

    /** 状态：PENDING / SELECTED / FETCHING / FETCHED / FETCH_FAILED / IGNORED / PROMOTED */
    private String status;

    /** 转入观察池后的关联 ID */
    private Long watchlistId;

    /** 抓取 run_id（关联 shop_fetch_run.run_id） */
    private String fetchRunId;

    /** 转入精品池后的关联 ID */
    private Long premiumId;

    /** 最近一次抓取失败原因 */
    private String lastErrorMessage;

    /** 最近一次触发抓取时间 */
    private LocalDateTime lastFetchAt;

    /** 操作人 */
    private String operator;

    /** 人工备注 */
    private String note;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
