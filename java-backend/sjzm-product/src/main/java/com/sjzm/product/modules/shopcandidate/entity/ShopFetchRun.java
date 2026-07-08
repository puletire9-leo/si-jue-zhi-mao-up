package com.sjzm.product.modules.shopcandidate.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 店铺抓取运行记录：追溯每次卖家精灵店铺名查询的运行情况、使用次数消耗和抓取原因。
 *
 * <p>每次候选确认/观察池抓取/精品复抓都落一条 run，成功失败都记录，方便复盘使用次数消耗。
 * 各表关联 run 时存的都是 run_id 值（列名随表语义不同）：
 * shop_products.source_run_id / shop_candidate_pool.fetch_run_id / shop_premium_pool.last_fetch_run_id。</p>
 */
@Data
@TableName("shop_fetch_run")
public class ShopFetchRun {

    /** 抓取批次唯一标识 */
    @TableId
    private String runId;

    /** 站点 */
    private String marketplace;

    /** 店铺名 */
    private String sellerName;

    /** 触发类型：CANDIDATE_CONFIRM / WATCHLIST / PREMIUM_REFRESH / MANUAL */
    private String triggerType;

    /** 来源记录 ID（候选池/观察池/精品池 id） */
    private Long triggerId;

    /** 抓取原因 */
    private String fetchReason;

    /** ISO 周批次 */
    private String batchCode;

    /** 入库日期 yyyyMMdd */
    private String batchDate;

    /** 固定 Y */
    private String variationMode;

    /** 卖家精灵返回总数 */
    private Integer total;

    /** 实际拉取的商品行数 */
    private Integer fetchedCount;

    /** 成功写入/更新的商品行数 */
    private Integer writtenCount;

    /** 解析或写入失败的商品行数 */
    private Integer failedCount;

    /** 消耗的卖家精灵使用次数 */
    private Integer apiCalls;

    /** 状态：RUNNING / SUCCESS / PARTIAL_SUCCESS / FAILED */
    private String status;

    /** 错误详情 */
    private String errorMessage;

    /** 开始时间 */
    private LocalDateTime startedAt;

    /** 结束时间 */
    private LocalDateTime finishedAt;
}
