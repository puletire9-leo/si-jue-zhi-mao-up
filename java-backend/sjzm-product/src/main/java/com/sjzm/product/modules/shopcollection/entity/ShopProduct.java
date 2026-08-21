package com.sjzm.product.modules.shopcollection.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.sjzm.product.entity.CompetitorProduct;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * 店铺商品全集：卖家精灵"店铺名查询"返回的店铺商品，固定 variation=Y（不含变体父体口径）。
 * 与新品榜 competitor_products、郑总盘子 deng_zong_shop 三条数据源分开，分析证据统一。
 *
 * <p>继承 {@link CompetitorProduct}（2026-08-13 继承收敛）：卖家精灵返回的 ~60 列字段能力
 * 全部来自基类，本类只声明店铺抓取专用的 10 个元信息字段。基类加字段时自动同步，消除手抄漂移。
 * 主键策略与基类一致（ASSIGN_ID），无需覆盖。
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("shop_products")
public class ShopProduct extends CompetitorProduct {

    // 店铺抓取专用元信息（基类没有的独有字段）
    private String batchDate;
    private String batchCode;
    private String sourceRunId;
    private String fetchSource;
    private String fetchReason;
    private Long watchlistId;
    private String variationMode;
    private String rawJson;
    private LocalDateTime firstSeenAt;
    private LocalDateTime lastSeenAt;
}
