package com.sjzm.product.modules.lingxing;

import java.util.List;
import java.util.Locale;

/**
 * 理实团队开品准入标签。周表用 tag_id，日表用中文 tag_name。
 * 与 {@code LingxingProductUnifiedMapper.xml} 的 6 个 FIND_IN_SET 必须保持一致。
 */
public final class LingxingTeamListingTags {

    public static final List<String> TAG_IDS = List.of(
            "907563170455592213",
            "907654877317203632",
            "907585631391968576",
            "907585847123066054",
            "907596133278666918",
            "907657425150046095");

    public static final List<String> TAG_NAMES = List.of(
            "欧洲精铺2025",
            "欧洲精铺2025非标品",
            "欧洲精铺2025淘汰",
            "欧洲精铺2025待淘汰",
            "欧洲精铺2025季节性断货",
            "绿标");

    private LingxingTeamListingTags() {
    }

    /** 日事实 tag_names 是否命中任一团队标签。逗号分隔，禁止用 contains 以免「欧洲精铺2025」误伤「淘汰」。 */
    public static boolean matchesTagNames(String tagNames) {
        if (tagNames == null || tagNames.isBlank()) {
            return false;
        }
        String[] parts = tagNames.split(",");
        for (String part : parts) {
            String token = part.trim();
            if (token.isEmpty()) {
                continue;
            }
            for (String allowed : TAG_NAMES) {
                if (allowed.equalsIgnoreCase(token)) {
                    return true;
                }
            }
        }
        return false;
    }

    public static boolean matchesTagIds(String tagIds) {
        if (tagIds == null || tagIds.isBlank()) {
            return false;
        }
        String[] parts = tagIds.split(",");
        for (String part : parts) {
            String token = part.trim().toLowerCase(Locale.ROOT);
            if (token.isEmpty()) {
                continue;
            }
            for (String allowed : TAG_IDS) {
                if (allowed.equalsIgnoreCase(token)) {
                    return true;
                }
            }
        }
        return false;
    }
}
