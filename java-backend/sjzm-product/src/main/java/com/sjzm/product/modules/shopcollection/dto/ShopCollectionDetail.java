package com.sjzm.product.modules.shopcollection.dto;

import com.sjzm.product.modules.analysisbaseline.shopprofile.dto.ShopProfileCategory;
import com.sjzm.product.modules.analysisbaseline.shopprofile.dto.ShopProfileSummary;
import com.sjzm.product.modules.shopcollection.entity.ShopWatchlist;
import lombok.Data;

import java.util.List;

/**
 * 单店全景详情：把"为什么进观察池 + 全集 A/B/C/D 画像 + 类目结构"聚合成一个视图，
 * 服务前端单店详情页。商品明细分页单独走 /products 接口，避免一次拉全。
 */
@Data
public class ShopCollectionDetail {

    /** 观察池记录：这家店因为哪张方法卡/基线/人工判断进来的（可能多条来源） */
    private List<ShopWatchlist> watchlistEntries;

    /** 店铺全集画像摘要：商品数、A/B/C/D、ABC 稳定盘、D 测品池、top 类目 */
    private ShopProfileSummary profile;

    /** 全集类目结构：按销量等级聚合的末级类目 */
    private List<ShopProfileCategory> categories;
}
