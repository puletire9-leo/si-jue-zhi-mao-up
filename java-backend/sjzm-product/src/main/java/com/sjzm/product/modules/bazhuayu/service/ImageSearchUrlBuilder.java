package com.sjzm.product.modules.bazhuayu.service;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/**
 * 亚马逊视觉搜索 URL 构造。
 * 把 ASIN 的图片 URL 做 URL 编码后拼到各站点视觉搜索页的 ?q= 后面。
 *
 * 注意各站点入口不同：
 *   UK     → stylesnap
 *   US/DE  → shopthelook
 */
public final class ImageSearchUrlBuilder {

    private ImageSearchUrlBuilder() {}

    /** 构造站点视觉搜索 URL。imageUrl 为空返回 null。marketplace 大小写不敏感。 */
    public static String build(String marketplace, String imageUrl) {
        if (imageUrl == null || imageUrl.isBlank()) return null;
        String q = URLEncoder.encode(imageUrl.trim(), StandardCharsets.UTF_8);
        String mp = marketplace == null ? "" : marketplace.trim().toUpperCase();
        return switch (mp) {
            case "UK" -> "https://www.amazon.co.uk/stylesnap?q=" + q;
            case "DE" -> "https://www.amazon.de/shopthelook?q=" + q;
            default   -> "https://www.amazon.com/shopthelook?q=" + q; // US 及兜底
        };
    }
}
