package com.sjzm.product.modules.requestcenter.model;

/**
 * 卖家精灵店铺分页抓取的统一保护策略。
 */
public final class SellerspriteShopFetchPolicy {

    public static final int MAX_API_CALLS_PER_SHOP = 10;
    public static final String LIMIT_REASON = "单店卖家精灵请求已达到10次上限，已停止剩余分页并继续下一个店铺";

    private SellerspriteShopFetchPolicy() {
    }

    public static boolean reachedRequestLimit(int apiCalls) {
        return apiCalls >= MAX_API_CALLS_PER_SHOP;
    }
}
