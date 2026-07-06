package com.sjzm.product.modules.shoprating.dto;

import lombok.Data;

import java.math.BigDecimal;

/**
 * 店铺方法卡命中数排名条目：一家店在某方法卡标准下产出了多少合格新品。
 */
@Data
public class ShopMethodRankItem {
    /** 店铺名 */
    private String sellerName;
    /** 站点 */
    private String marketplace;
    /** 合格新品数（命中方法卡标准的父群组数），排名主指标 */
    private Integer hitCount;
    /** 主打子类目（命中品里最高频的 node_label_path 末级） */
    private String topCategory;
    /** 命中品均价 */
    private BigDecimal avgPrice;
}
