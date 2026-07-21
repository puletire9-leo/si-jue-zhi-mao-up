package com.sjzm.product.modules.bazhuayu.service;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * 亚马逊视觉搜索 URL 构造。
 * 把 ASIN 的图片 URL 做 URL 编码后拼到各站点视觉搜索页的 ?q= 后面。
 *
 * 注意各站点入口不同：
 *   UK     → stylesnap
 *   US/DE  → shopthelook
 */
public final class ImageSearchUrlBuilder {

    private static final Pattern AMAZON_SIZE_MODIFIER = Pattern.compile(
            "\\.(?:_[^/?#]*_|\\*[^/?#]*\\*)\\.(jpe?g|png|webp)(?=([?#]|$))",
            Pattern.CASE_INSENSITIVE);

    private ImageSearchUrlBuilder() {}

    /** 构造站点视觉搜索 URL。imageUrl 为空返回 null。marketplace 大小写不敏感。 */
    public static String build(String marketplace, String imageUrl) {
        if (imageUrl == null || imageUrl.isBlank()) return null;
        String q = URLEncoder.encode(normalizeSourceImageUrl(imageUrl), StandardCharsets.UTF_8);
        String mp = marketplace == null ? "" : marketplace.trim().toUpperCase();
        return switch (mp) {
            case "UK" -> "https://www.amazon.co.uk/stylesnap?q=" + q;
            case "DE" -> "https://www.amazon.de/shopthelook?q=" + q;
            default   -> "https://www.amazon.com/shopthelook?q=" + q; // US 及兜底
        };
    }

    /**
     * Amazon 搜索页常返回 US200/SX 等缩略图。去掉 CDN 尺寸修饰符后可取得原图，
     * 避免 StyleSnap 对低分辨率图片静默返回默认上传页。
     */
    public static String normalizeSourceImageUrl(String imageUrl) {
        if (imageUrl == null) return null;
        String normalized = imageUrl.trim().replace("\\_", "_");
        String lower = normalized.toLowerCase(Locale.ROOT);
        boolean amazonImage = lower.contains("m.media-amazon.com/")
                || lower.contains("images-na.ssl-images-amazon.com/")
                || lower.contains("images-eu.ssl-images-amazon.com/");
        if (!amazonImage) return normalized;
        return AMAZON_SIZE_MODIFIER.matcher(normalized).replaceFirst(".$1");
    }
}
