package com.sjzm.product.service;

import com.sjzm.product.entity.CompetitorProduct;
import com.sjzm.product.methodrule.M01Rule;
import com.sjzm.product.modules.bazhuayu.service.ImageSearchUrlBuilder;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;

/**
 * Shared product base-feature derivation.
 *
 * <p>This layer describes reusable product facts only. Method-card hit decisions
 * such as M01/M03 eligibility must stay in their own consumer flows.
 */
@Service
public class ProductFeatureProcessor {

    public void applyBaseFeatures(CompetitorProduct product, String marketplace, String source) {
        int listingDays = calcListingDays(product.getAvailableDate());
        BigDecimal weightG = extractWeightGrams(product.getWeight());

        product.setListingDays(listingDays);
        product.setWeightG(weightG);
        product.setSalesTier(classifySalesTier(product.getUnits()));
        product.setProductUrl(buildProductUrl(product.getAsin(), marketplace));
        product.setSimilarUrl(buildSimilarUrl(product.getImageUrl(), marketplace));
        product.setSource(source);
    }

    public String classifySalesTier(Integer units) {
        if (units == null) return "UNKNOWN";
        if (units >= 100) return "A";
        if (units >= 50) return "B";
        if (units >= 15) return "C";
        return "D";
    }

    /**
     * Keep the existing missing-date behavior: new-product source rows without
     * available_date use the M01 unknown-listing fallback instead of aging out.
     */
    public int calcListingDays(Long availableDate) {
        if (availableDate == null || availableDate == 0) return M01Rule.UNKNOWN_LISTING_DAYS_DEFAULT;
        LocalDate listingDate = Instant.ofEpochMilli(availableDate)
                .atZone(ZoneId.of("Asia/Shanghai")).toLocalDate();
        return (int) ChronoUnit.DAYS.between(listingDate, LocalDate.now());
    }

    public BigDecimal extractWeightGrams(String weightStr) {
        if (weightStr == null || weightStr.isEmpty()) return null;
        try {
            String lower = weightStr.toLowerCase();
            java.util.regex.Matcher m = java.util.regex.Pattern.compile("(\\d+\\.?\\d*)\\s*(g|kg|pounds|ounces)")
                    .matcher(lower);
            if (m.find()) {
                double val = Double.parseDouble(m.group(1));
                String unit = m.group(2);
                if ("kg".equals(unit)) val *= 1000;
                else if ("pounds".equals(unit)) val *= 453.592;
                else if ("ounces".equals(unit)) val *= 28.3495;
                return BigDecimal.valueOf(val);
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    public String buildProductUrl(String asin, String marketplace) {
        if (asin == null) return null;
        return switch (marketplace) {
            case "UK" -> "https://www.amazon.co.uk/dp/" + asin;
            case "DE" -> "https://www.amazon.de/dp/" + asin;
            case "US" -> "https://www.amazon.com/dp/" + asin;
            default -> "https://www.amazon.co.uk/dp/" + asin;
        };
    }

    public String buildSimilarUrl(String imageUrl, String marketplace) {
        return ImageSearchUrlBuilder.build(marketplace, imageUrl);
    }
}
