package com.sjzm.product.modules.lingxing.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 领星亚马逊店铺（seller/lists 落库）。
 *
 * 用途：领星 {@code sid} 是产品表现 / ASIN 360 小时 / 利润统计等开放接口的必填/关键入参，
 * 本表是这些数据同步的「店铺维度」来源（见 张总蓝本 §一）。
 *
 * 幂等：唯一键 = 领星 {@code sid}（企业已授权店铺唯一标识）。
 * 同步走「按 sid 查存在 → 命中回填 id → saveOrUpdate」，反复同步只更新不堆积。
 *
 * 见 java-backend/sql/create_lingxing_seller.sql
 */
@Data
@TableName("lingxing_seller")
public class LingxingSeller {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    /** 店铺 ID（领星对企业已授权店铺的唯一标识，幂等唯一键） */
    private Long sid;

    /** 站点 ID */
    private Long mid;

    /** 店铺名 */
    private String name;

    /** 亚马逊店铺 ID */
    private String sellerId;

    /** 店铺账户名称 */
    private String accountName;

    /** 店铺账号 ID */
    private Long sellerAccountId;

    /** 站点简称（如 NA 指北美） */
    private String region;

    /** 商城所在国家名称 */
    private String country;

    /** 是否授权广告：0-否，1-是 */
    private Integer hasAdsSetting;

    /** 市场 ID */
    private String marketplaceId;

    /** 店铺状态：0-停止同步，1-正常，2-授权异常，3-欠费停服 */
    private Integer status;

    /** 领星原始行 JSON 整包留底 */
    private String rawJson;

    /** 本地同步入库时间 */
    private LocalDateTime syncedAt;
}
