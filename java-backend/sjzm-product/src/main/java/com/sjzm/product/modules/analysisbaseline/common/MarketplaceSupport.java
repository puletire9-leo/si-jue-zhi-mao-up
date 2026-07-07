package com.sjzm.product.modules.analysisbaseline.common;

import org.springframework.util.StringUtils;

import java.util.Locale;
import java.util.Set;

public final class MarketplaceSupport {

    private static final Set<String> SUPPORTED_MARKETPLACES = Set.of("UK", "DE", "US");

    private MarketplaceSupport() {
    }

    public static String require(String marketplace) {
        String normalized = normalizeOptional(marketplace);
        if (!StringUtils.hasText(normalized)) {
            throw new IllegalArgumentException("marketplace 不能为空，仅支持 UK/DE/US");
        }
        return normalized;
    }

    public static String normalizeOptional(String marketplace) {
        if (!StringUtils.hasText(marketplace)) {
            return null;
        }
        String normalized = marketplace.trim().toUpperCase(Locale.ROOT);
        if (!SUPPORTED_MARKETPLACES.contains(normalized)) {
            throw new IllegalArgumentException("marketplace 仅支持 UK/DE/US，不支持 " + normalized);
        }
        return normalized;
    }
}
