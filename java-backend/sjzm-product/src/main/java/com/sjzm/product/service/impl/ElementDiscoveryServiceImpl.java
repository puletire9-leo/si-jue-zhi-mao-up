package com.sjzm.product.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.sjzm.product.dto.ProductTitleParseResult;
import com.sjzm.product.entity.CompetitorProduct;
import com.sjzm.product.mapper.CompetitorProductMapper;
import com.sjzm.product.service.ElementDiscoveryService;
import com.sjzm.product.service.ProductTitleParsingService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class ElementDiscoveryServiceImpl implements ElementDiscoveryService {

    private static final int DEFAULT_SCAN_LIMIT = 500;
    private static final int MAX_SCAN_LIMIT = 5000;
    private static final int DEFAULT_TOP_N = 20;
    private static final int MAX_TOP_N = 100;
    private static final int DEFAULT_SAMPLE_PER_CARRIER = 3;
    private static final int MAX_SAMPLE_PER_CARRIER = 10;
    private static final int MAX_FILTERED_SAMPLES = 15;
    private static final List<FilterPhraseRule> FILTER_RULES = List.of(
            rule("fitment_or_hardware", Set.of(
                    "key fob",
                    "key shell",
                    "valve stem",
                    "dust cap",
                    "headrest",
                    "center console",
                    "bottom bracket",
                    "lockring",
                    "car tire",
                    "car tyre",
                    "tyre valve",
                    "tire valve",
                    "non slip drink holder",
                    "tesla model",
                    "land rover",
                    "range rover",
                    "mercedes",
                    "jaguar",
                    "freelander",
                    "discovery 4"
            )),
            rule("official_merch_or_collectible", Set.of(
                    "official merchandise",
                    "amazon exclusive",
                    "funko pop",
                    "digitally reproduced signature",
                    "battle pack",
                    "minifigures",
                    "licensed design"
            )),
            rule("utility_or_functional_standard", Set.of(
                    "cold packs",
                    "ice packs",
                    "bpa free",
                    "leak proof",
                    "cleaning brush",
                    "car drying",
                    "detailing",
                    "memory foam",
                    "wrist rest",
                    "support set",
                    "flip lid",
                    "sportkappe",
                    "sonnenschutz"
            )),
            rule("poster_schedule_or_event_chart", Set.of(
                    "wall chart",
                    "chart schedule",
                    "team fixtures",
                    "tournament display",
                    "football backdrop",
                    "poster gift"
            )),
            rule("costume_or_utility_bundle", Set.of(
                    "performance outfit",
                    "cosplay",
                    "sequin costume",
                    "wearable beach bag",
                    "cushion cover only",
                    "feeding tray",
                    "bird bath",
                    "water feeder"
            ))
    );
    private static final Set<String> GENERIC_ELEMENT_TOKENS = Set.of(
            "amazon",
            "official",
            "exclusive",
            "licensed",
            "collectable",
            "collectible",
            "premium",
            "vinyl",
            "model",
            "kids",
            "kid",
            "swim",
            "mesh",
            "microfibre",
            "cleaner",
            "drying",
            "car",
            "accessories",
            "accessory",
            "key",
            "case",
            "shell",
            "dust",
            "valve",
            "chart",
            "schedule",
            "outfit",
            "costume",
            "gloves",
            "sunglasses",
            "backdrop",
            "bench",
            "cushion",
            "feeder",
            "bath",
            "convertible",
            "new",
            "cold",
            "lasting",
            "long",
            "flavoured",
            "flavored",
            "golf",
            "lauf",
            "interactive",
            "music",
            "battle",
            "toy",
            "aluminium",
            "disney",
            "stor",
            "tyre",
            "tire"
    );

    private final CompetitorProductMapper competitorProductMapper;
    private final ProductTitleParsingService productTitleParsingService;

    @Override
    public Map<String, Object> previewPath2(String marketplace,
                                            String month,
                                            int scanLimit,
                                            int topN,
                                            int minProducts,
                                            int minTotalUnits) {
        String normalizedMarketplace = normalizeMarketplace(marketplace);
        String resolvedMonth = resolveMonth(normalizedMarketplace, month);
        int safeScanLimit = normalizeScanLimit(scanLimit);
        int safeTopN = normalizeTopN(topN);
        int safeMinProducts = Math.max(1, minProducts);
        int safeMinTotalUnits = Math.max(0, minTotalUnits);

        List<CompetitorProduct> scannedProducts = loadCandidateProducts(normalizedMarketplace, resolvedMonth, safeScanLimit);
        Map<String, ElementBucket> buckets = new LinkedHashMap<>();
        List<Map<String, Object>> parsedSamples = new ArrayList<>();
        Map<String, Integer> filteredByReason = new LinkedHashMap<>();
        List<Map<String, Object>> filteredSamples = new ArrayList<>();

        int parsedProducts = 0;
        int filteredStandardProducts = 0;
        for (CompetitorProduct product : scannedProducts) {
            ProductTitleParseResult parseResult = productTitleParsingService.parse(product.getTitle());
            if (!parseResult.hasCarrier() || parseResult.element() == null || parseResult.element().isBlank()) {
                continue;
            }
            String filterReason = determineNonStandardFilterReason(product, parseResult);
            if (filterReason != null) {
                filteredStandardProducts++;
                filteredByReason.merge(filterReason, 1, Integer::sum);
                if (filteredSamples.size() < MAX_FILTERED_SAMPLES) {
                    filteredSamples.add(toFilteredSampleRow(product, parseResult, filterReason));
                }
                continue;
            }
            parsedProducts++;
            if (parsedSamples.size() < Math.min(20, safeTopN * 2)) {
                parsedSamples.add(toSampleRow(product, parseResult));
            }

            String elementKey = normalizeElementKey(parseResult.element());
            ElementBucket bucket = buckets.computeIfAbsent(elementKey, ignored -> new ElementBucket(parseResult.element()));
            bucket.add(product, parseResult);
        }

        List<Map<String, Object>> topElements = buckets.values().stream()
                .filter(bucket -> bucket.productCount >= safeMinProducts)
                .filter(bucket -> bucket.totalUnits >= safeMinTotalUnits)
                .sorted(Comparator
                        .comparingInt(ElementBucket::carrierCount).reversed()
                        .thenComparingInt(ElementBucket::totalUnits).reversed()
                        .thenComparingInt(ElementBucket::productCount).reversed()
                        .thenComparing(bucket -> bucket.element.toLowerCase(Locale.ROOT)))
                .limit(safeTopN)
                .map(ElementBucket::toResultRow)
                .toList();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("marketplace", normalizedMarketplace);
        result.put("month", resolvedMonth);
        result.put("scanLimit", safeScanLimit);
        result.put("scannedProducts", scannedProducts.size());
        result.put("parsedProducts", parsedProducts);
        result.put("filteredStandardProducts", filteredStandardProducts);
        result.put("filteredByReason", filteredByReason);
        result.put("returnedElements", topElements.size());
        result.put("minProducts", safeMinProducts);
        result.put("minTotalUnits", safeMinTotalUnits);
        result.put("topElements", topElements);
        result.put("samples", parsedSamples);
        result.put("filteredSamples", filteredSamples);
        return result;
    }

    @Override
    public Map<String, Object> previewCarrierMatch(String marketplace,
                                                   String month,
                                                   int scanLimit,
                                                   int topN,
                                                   int samplePerCarrier,
                                                   String carrier) {
        String normalizedMarketplace = normalizeMarketplace(marketplace);
        String resolvedMonth = resolveMonth(normalizedMarketplace, month);
        int safeScanLimit = normalizeScanLimit(scanLimit);
        int safeTopN = normalizeTopN(topN);
        int safeSamplePerCarrier = normalizeSamplePerCarrier(samplePerCarrier);
        List<String> supportedCarriers = productTitleParsingService.listSupportedCarriers();
        String carrierFilter = normalizeCarrierFilter(carrier, supportedCarriers);

        List<CompetitorProduct> scannedProducts = loadCandidateProducts(normalizedMarketplace, resolvedMonth, safeScanLimit);
        Map<String, CarrierAuditBucket> carrierBuckets = new LinkedHashMap<>();
        Map<String, Integer> filteredByReason = new LinkedHashMap<>();

        int matchedProducts = 0;
        int keptNonStandardProducts = 0;
        int filteredStandardProducts = 0;

        for (CompetitorProduct product : scannedProducts) {
            ProductTitleParseResult parseResult = productTitleParsingService.parse(product.getTitle());
            if (!parseResult.hasCarrier()) {
                continue;
            }
            if (carrierFilter != null && !carrierFilter.equals(parseResult.carrier())) {
                continue;
            }

            matchedProducts++;
            String filterReason = determineCarrierAuditFilterReason(product);
            if (filterReason != null) {
                filteredStandardProducts++;
                filteredByReason.merge(filterReason, 1, Integer::sum);
            } else {
                keptNonStandardProducts++;
            }

            CarrierAuditBucket bucket = carrierBuckets.computeIfAbsent(
                    parseResult.carrier(),
                    ignored -> new CarrierAuditBucket(parseResult.carrier(), safeSamplePerCarrier)
            );
            bucket.add(product, filterReason, toSampleRow(product, parseResult));
        }

        List<Map<String, Object>> topCarriers = carrierBuckets.values().stream()
                .sorted(Comparator
                        .comparingInt(CarrierAuditBucket::keptNonStandardProducts).reversed()
                        .thenComparingInt(CarrierAuditBucket::matchedProducts).reversed()
                        .thenComparingInt(CarrierAuditBucket::totalUnits).reversed()
                        .thenComparing(bucket -> bucket.carrier().toLowerCase(Locale.ROOT)))
                .limit(safeTopN)
                .map(CarrierAuditBucket::toResultRow)
                .toList();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("marketplace", normalizedMarketplace);
        result.put("month", resolvedMonth);
        result.put("scanLimit", safeScanLimit);
        result.put("carrierSource", "document_bootstrap");
        result.put("carrierSourceNote",
                "Current carrier anchors are bootstrapped from docs/选品方法库/补充/载体元素三语映射表.md. " +
                        "Later this should move to a manually maintained selection carrier table.");
        result.put("supportedCarrierCount", supportedCarriers.size());
        result.put("supportedCarriers", supportedCarriers);
        result.put("carrierFilter", carrierFilter);
        result.put("scannedProducts", scannedProducts.size());
        result.put("matchedProducts", matchedProducts);
        result.put("matchedCarrierCount", carrierBuckets.size());
        result.put("keptNonStandardProducts", keptNonStandardProducts);
        result.put("filteredStandardProducts", filteredStandardProducts);
        result.put("precisionProxy", ratio(keptNonStandardProducts, matchedProducts));
        result.put("filteredByReason", filteredByReason);
        result.put("returnedCarriers", topCarriers.size());
        result.put("topCarriers", topCarriers);
        return result;
    }

    private String determineNonStandardFilterReason(CompetitorProduct product, ProductTitleParseResult parseResult) {
        String normalizedTitle = normalizeText(product.getTitle());
        for (FilterPhraseRule rule : FILTER_RULES) {
            if (rule.matches(normalizedTitle)) {
                return rule.reason();
            }
        }
        return hasDistinctElementToken(parseResult.element()) ? null : "generic_element_only";
    }

    private String determineCarrierAuditFilterReason(CompetitorProduct product) {
        String normalizedTitle = normalizeText(product.getTitle());
        for (FilterPhraseRule rule : FILTER_RULES) {
            if (rule.matches(normalizedTitle)) {
                return rule.reason();
            }
        }
        return null;
    }

    private boolean hasDistinctElementToken(String element) {
        String normalizedElement = normalizeText(element);
        if (normalizedElement.isBlank()) {
            return false;
        }
        for (String token : normalizedElement.split("\\s+")) {
            if (token.isBlank() || token.matches("\\d+[a-z]*") || token.length() == 1) {
                continue;
            }
            if (!GENERIC_ELEMENT_TOKENS.contains(token)) {
                return true;
            }
        }
        return false;
    }

    private String normalizeText(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        return value.toLowerCase(Locale.ROOT)
                .replaceAll("[^\\p{IsAlphabetic}\\p{IsDigit}]+", " ")
                .trim()
                .replaceAll("\\s+", " ");
    }

    private Map<String, Object> toFilteredSampleRow(CompetitorProduct product,
                                                    ProductTitleParseResult parseResult,
                                                    String filterReason) {
        Map<String, Object> row = toSampleRow(product, parseResult);
        row.put("filterReason", filterReason);
        return row;
    }

    private List<CompetitorProduct> loadCandidateProducts(String marketplace, String month, int scanLimit) {
        QueryWrapper<CompetitorProduct> wrapper = new QueryWrapper<>();
        wrapper.select("marketplace", "asin", "`month`", "title", "brand", "node_label_path", "units", "bsr", "price")
                .eq("marketplace", marketplace)
                .eq("month", month)
                .isNotNull("title")
                .ne("title", "")
                .orderByDesc("units")
                .orderByAsc("asin")
                .last("LIMIT " + scanLimit);
        return competitorProductMapper.selectList(wrapper);
    }

    private Map<String, Object> toSampleRow(CompetitorProduct product, ProductTitleParseResult parseResult) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("asin", product.getAsin());
        row.put("marketplace", product.getMarketplace());
        row.put("month", product.getMonth());
        row.put("brand", product.getBrand());
        row.put("rawSubCategory", extractLeafSubcategory(product.getNodeLabelPath()));
        row.put("carrier", parseResult.carrier());
        row.put("element", parseResult.element());
        row.put("units", product.getUnits());
        row.put("bsr", product.getBsr());
        row.put("price", product.getPrice());
        row.put("title", product.getTitle());
        return row;
    }

    private String resolveMonth(String marketplace, String month) {
        String normalizedMonth = normalizeMonth(month);
        if (normalizedMonth != null) {
            return normalizedMonth;
        }
        String latestMonth = competitorProductMapper.selectLatestMonth(marketplace);
        if (latestMonth == null || latestMonth.isBlank()) {
            throw new IllegalStateException("competitor_products 没有可用 month 数据");
        }
        return latestMonth;
    }

    private String normalizeMarketplace(String marketplace) {
        String normalized = trimToNull(marketplace);
        if (normalized == null) {
            return "UK";
        }
        return normalized.toUpperCase(Locale.ROOT);
    }

    private String normalizeMonth(String month) {
        String value = trimToNull(month);
        if (value == null) {
            return null;
        }
        String normalized = value.replace("-", "").replace("/", "");
        if (!normalized.matches("\\d{6}")) {
            throw new IllegalArgumentException("month 只支持 yyyyMM 或 yyyy-MM");
        }
        return normalized;
    }

    private int normalizeScanLimit(int scanLimit) {
        if (scanLimit <= 0) {
            return DEFAULT_SCAN_LIMIT;
        }
        return Math.min(scanLimit, MAX_SCAN_LIMIT);
    }

    private int normalizeTopN(int topN) {
        if (topN <= 0) {
            return DEFAULT_TOP_N;
        }
        return Math.min(topN, MAX_TOP_N);
    }

    private int normalizeSamplePerCarrier(int samplePerCarrier) {
        if (samplePerCarrier <= 0) {
            return DEFAULT_SAMPLE_PER_CARRIER;
        }
        return Math.min(samplePerCarrier, MAX_SAMPLE_PER_CARRIER);
    }

    private String normalizeCarrierFilter(String carrier, List<String> supportedCarriers) {
        String normalized = trimToNull(carrier);
        if (normalized == null) {
            return null;
        }
        for (String supportedCarrier : supportedCarriers) {
            if (supportedCarrier.equalsIgnoreCase(normalized)) {
                return supportedCarrier;
            }
        }
        throw new IllegalArgumentException("unsupported carrier filter: " + carrier);
    }

    private String normalizeElementKey(String element) {
        return element.toLowerCase(Locale.ROOT).trim().replaceAll("\\s+", " ");
    }

    private BigDecimal ratio(int numerator, int denominator) {
        if (denominator <= 0) {
            return BigDecimal.ZERO;
        }
        return BigDecimal.valueOf(numerator)
                .divide(BigDecimal.valueOf(denominator), 4, RoundingMode.HALF_UP);
    }

    private String extractLeafSubcategory(String nodeLabelPath) {
        String value = trimToNull(nodeLabelPath);
        if (value == null) {
            return null;
        }
        int index = value.lastIndexOf(':');
        return index >= 0 ? trimToNull(value.substring(index + 1)) : value;
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static FilterPhraseRule rule(String reason, Set<String> phrases) {
        return new FilterPhraseRule(reason, phrases);
    }

    private record FilterPhraseRule(String reason, Set<String> phrases) {
        private boolean matches(String normalizedTitle) {
            for (String phrase : phrases) {
                if (normalizedTitle.contains(phrase)) {
                    return true;
                }
            }
            return false;
        }
    }

    private static final class ElementBucket {
        private final String element;
        private int productCount;
        private int totalUnits;
        private int pricedProducts;
        private BigDecimal totalPrice = BigDecimal.ZERO;
        private int bsrCount;
        private long totalBsr;
        private Integer minBsr;
        private final Set<String> carriers = new LinkedHashSet<>();
        private final Set<String> rawSubcategories = new LinkedHashSet<>();
        private final List<String> sampleTitles = new ArrayList<>();

        private ElementBucket(String element) {
            this.element = element;
        }

        private void add(CompetitorProduct product, ProductTitleParseResult parseResult) {
            productCount++;
            totalUnits += product.getUnits() == null ? 0 : product.getUnits();
            carriers.add(parseResult.carrier());
            String rawSubcategory = product.getNodeLabelPath();
            if (rawSubcategory != null && !rawSubcategory.isBlank()) {
                int index = rawSubcategory.lastIndexOf(':');
                rawSubcategories.add(index >= 0 ? rawSubcategory.substring(index + 1).trim() : rawSubcategory.trim());
            }
            if (product.getPrice() != null) {
                pricedProducts++;
                totalPrice = totalPrice.add(product.getPrice());
            }
            if (product.getBsr() != null) {
                bsrCount++;
                totalBsr += product.getBsr();
                minBsr = minBsr == null ? product.getBsr() : Math.min(minBsr, product.getBsr());
            }
            if (sampleTitles.size() < 3 && product.getTitle() != null && !product.getTitle().isBlank()) {
                sampleTitles.add(product.getTitle());
            }
        }

        private int carrierCount() {
            return carriers.size();
        }

        private int totalUnits() {
            return totalUnits;
        }

        private int productCount() {
            return productCount;
        }

        private Map<String, Object> toResultRow() {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("element", element);
            row.put("productCount", productCount);
            row.put("totalUnits", totalUnits);
            row.put("carrierCount", carriers.size());
            row.put("carriers", new ArrayList<>(carriers));
            row.put("rawSubcategories", new ArrayList<>(rawSubcategories));
            row.put("avgPrice", pricedProducts == 0
                    ? null
                    : totalPrice.divide(BigDecimal.valueOf(pricedProducts), 2, RoundingMode.HALF_UP));
            row.put("avgBsr", bsrCount == 0 ? null : totalBsr / bsrCount);
            row.put("bestBsr", minBsr);
            row.put("sampleTitles", sampleTitles);
            return row;
        }
    }

    private final class CarrierAuditBucket {
        private final String carrier;
        private final int samplePerCarrier;
        private int matchedProducts;
        private int keptNonStandardProducts;
        private int filteredStandardProducts;
        private int totalUnits;
        private Integer bestBsr;
        private final Map<String, Integer> filteredByReason = new LinkedHashMap<>();
        private final Set<String> rawSubcategories = new LinkedHashSet<>();
        private final List<Map<String, Object>> keptSamples = new ArrayList<>();
        private final List<Map<String, Object>> filteredSamples = new ArrayList<>();

        private CarrierAuditBucket(String carrier, int samplePerCarrier) {
            this.carrier = carrier;
            this.samplePerCarrier = samplePerCarrier;
        }

        private void add(CompetitorProduct product, String filterReason, Map<String, Object> row) {
            matchedProducts++;
            if (product.getUnits() != null) {
                totalUnits += product.getUnits();
            }
            if (product.getBsr() != null) {
                bestBsr = bestBsr == null ? product.getBsr() : Math.min(bestBsr, product.getBsr());
            }
            String rawSubcategory = extractLeafSubcategory(product.getNodeLabelPath());
            if (rawSubcategory != null) {
                rawSubcategories.add(rawSubcategory);
            }
            if (filterReason != null) {
                filteredStandardProducts++;
                filteredByReason.merge(filterReason, 1, Integer::sum);
                row.put("filterReason", filterReason);
                if (filteredSamples.size() < samplePerCarrier) {
                    filteredSamples.add(row);
                }
                return;
            }

            keptNonStandardProducts++;
            if (keptSamples.size() < samplePerCarrier) {
                keptSamples.add(row);
            }
        }

        private String carrier() {
            return carrier;
        }

        private int matchedProducts() {
            return matchedProducts;
        }

        private int keptNonStandardProducts() {
            return keptNonStandardProducts;
        }

        private int totalUnits() {
            return totalUnits;
        }

        private Map<String, Object> toResultRow() {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("carrier", carrier);
            row.put("matchedProducts", matchedProducts);
            row.put("keptNonStandardProducts", keptNonStandardProducts);
            row.put("filteredStandardProducts", filteredStandardProducts);
            row.put("precisionProxy", ratio(keptNonStandardProducts, matchedProducts));
            row.put("totalUnits", totalUnits);
            row.put("bestBsr", bestBsr);
            row.put("rawSubcategories", new ArrayList<>(rawSubcategories));
            row.put("filteredByReason", filteredByReason);
            row.put("keptSamples", keptSamples);
            row.put("filteredSamples", filteredSamples);
            return row;
        }
    }
}
