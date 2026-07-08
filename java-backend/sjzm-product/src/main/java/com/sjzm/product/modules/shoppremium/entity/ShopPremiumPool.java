package com.sjzm.product.modules.shoppremium.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 精品店铺池：长期复用、周期复抓的优质店铺名单。
 *
 * <p>状态拆分：
 * <ul>
 *   <li>{@code status}：是否属于精品池（ACTIVE/PAUSED/REMOVED）</li>
 *   <li>{@code refreshStatus}：复抓任务状态（IDLE/RUNNING/FAILED）</li>
 * </ul>
 * 两个字段不混用。REMOVED 是软删除，同店再加入时恢复原行而非新建。</p>
 */
@Data
@TableName("shop_premium_pool")
public class ShopPremiumPool {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String marketplace;
    private String sellerName;
    private String sellerId;

    /** CANDIDATE_PROMOTE / MANUAL / WATCHLIST_PROMOTE */
    private String sourceType;
    private Long sourceId;
    private String reason;
    private String tagsJson;

    /** HIGH / MID / LOW */
    private String qualityLevel;

    /** WEEKLY / MONTHLY / MANUAL */
    private String refreshFrequency;

    private String lastFetchRunId;
    private String lastFetchDate;
    private String nextFetchDate;

    /** IDLE / RUNNING / FAILED */
    private String refreshStatus;
    private String lastErrorMessage;

    /** ACTIVE / PAUSED / REMOVED */
    private String status;

    private String note;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
