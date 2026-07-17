package com.sjzm.product.modules.requestcenter.model;

/** 卖家名称级请求保护规则。 */
public final class SellerspriteSellerNamePolicy {

    public static final String BLOCKED_AMAZON_REASON = "禁止抓取通用店名 Amazon";

    private SellerspriteSellerNamePolicy() {
    }

    public static boolean isBlocked(String sellerName) {
        return sellerName != null && "Amazon".equalsIgnoreCase(sellerName.trim());
    }
}
