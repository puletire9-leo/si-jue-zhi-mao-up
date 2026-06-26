package com.sjzm.product.service.impl;

import com.sjzm.product.dto.ProductTitleParseResult;
import com.sjzm.product.entity.CompetitorProduct;
import com.sjzm.product.mapper.CompetitorProductMapper;
import com.sjzm.product.service.ElementDiscoveryService;
import com.sjzm.product.service.ProductTitleParsingService;
import com.sjzm.product.service.SalesBaselineService;
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
    private static final int MAX_SCAN_LIMIT = 20000;
    private static final int DEFAULT_TOP_N = 20;
    private static final int MAX_TOP_N = 100;
    private static final int DEFAULT_SAMPLE_PER_CARRIER = 3;
    private static final int MAX_SAMPLE_PER_CARRIER = 10;
    private static final int DEFAULT_MANUAL_LIMIT = 200;
    private static final int MAX_MANUAL_LIMIT = 1000;
    private static final int MAX_FILTERED_SAMPLES = 15;
    private static final Set<String> TOY_SET_ACCESSORY_CARRIERS = Set.of(
            "figure",
            "bracelet",
            "handbag"
    );
    private static final Set<String> SMARTWATCH_BAND_PHRASES = Set.of(
            "fitbit",
            "compatible for",
            "watch strap",
            "replacement band",
            "wrist strap"
    );
    private static final Set<String> PICTURE_FRAME_PHRASES = Set.of(
            "picture frame",
            "wall display",
            "poster frame",
            "wall decor frame"
    );
    private static final Set<String> GENERIC_WATER_BOTTLE_PHRASES = Set.of(
            "trinkflasche",
            "sportflasche",
            "wasserflasche",
            "faltbare",
            "auslaufsicher",
            "kohlensaure",
            "kohlensäure"
    );
    private static final Set<String> TOY_FIGURE_SET_PHRASES = Set.of(
            "mini sea animal",
            "mini reptile animal",
            "mini dino",
            "mini zoo animals",
            "plastic mini",
            "12 pack",
            "12 pcs",
            "blind box"
    );
    private static final Set<String> BACKDROP_FLAG_PACK_PHRASES = Set.of(
            "yard signs",
            "fan flags",
            "porch sign",
            "anniversary fan flags"
    );
    private static final Set<String> LUNCH_BAG_ACCESSORY_PHRASES = Set.of(
            "kuhlakkus",
            "kühlakkus",
            "kuhlpads",
            "kühlpads",
            "silikondeckel",
            "ersatz gummiband",
            "fur kuhltasche",
            "für kühltasche"
    );
    private static final Set<String> DRY_BAG_OR_TRACKER_PHRASES = Set.of(
            "dry bag",
            "packsack",
            "wasserdichte tasche",
            "tracker tag",
            "fanartikel",
            "handfahnen"
    );
    private static final Set<String> STICKER_FAN_SET_PRIMARY_PHRASES = Set.of(
            "handfahne",
            "handfahnen",
            "fahrradfahne",
            "fahrrad fahne",
            "blumenkette"
    );
    private static final Set<String> STICKER_FAN_SET_SECONDARY_PHRASES = Set.of(
            "fanartikel",
            "tattoo sticker",
            "public viewing"
    );
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
                    "licensed design",
                    "playmobil",
                    "lego duplo"
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
                    "sonnenschutz",
                    "chemical guys",
                    "degreaser",
                    "microfiber towel",
                    "drying towel",
                    "wash mitt",
                    "wheel cleaner",
                    "carpet cleaner"
            )),
            rule("poster_schedule_or_event_chart", Set.of(
                    "wall chart",
                    "chart schedule",
                    "team fixtures",
                    "tournament display",
                    "football backdrop",
                    "poster gift",
                    "sticker collection",
                    "wall planner",
                    "planner poster"
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
    private final SalesBaselineService salesBaselineService;

    @Override
    public Map<String, Object> previewPath2(String marketplace,
                                            String month,
                                            int scanLimit,
                                            int topN,
                                            int minProducts,
                                            int minTotalUnits) {
        String normalizedMarketplace = normalizeMarketplace(marketplace);
        int safeScanLimit = normalizeScanLimit(scanLimit);
        int safeTopN = normalizeTopN(topN);
        int safeMinProducts = Math.max(1, minProducts);
        int safeMinTotalUnits = Math.max(0, minTotalUnits);
        String resolvedMonth = resolveMonthOrNull(normalizedMarketplace, month);
        if (resolvedMonth == null) {
            return emptyPath2Result(normalizedMarketplace, safeScanLimit, safeTopN, safeMinProducts, safeMinTotalUnits);
        }

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
        int safeScanLimit = normalizeScanLimit(scanLimit);
        int safeTopN = normalizeTopN(topN);
        int safeSamplePerCarrier = normalizeSamplePerCarrier(samplePerCarrier);
        List<String> supportedCarriers = productTitleParsingService.listSupportedCarriers();
        String carrierFilter = normalizeCarrierFilter(carrier, supportedCarriers);
        String resolvedMonth = resolveMonthOrNull(normalizedMarketplace, month);
        if (resolvedMonth == null) {
            return emptyCarrierMatchResult(normalizedMarketplace, safeScanLimit, safeTopN, safeSamplePerCarrier,
                    supportedCarriers, carrierFilter);
        }

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
            String filterReason = determineCarrierAuditFilterReason(product, parseResult);
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
                "Current carrier anchors are bootstrapped from ProductTitleParsingServiceImpl.CARRIER_PATTERNS, " +
                        "which was seeded from docs/选品方法库/补充/载体元素三语映射表.md. " +
                        "Manual maintenance target is selection-agent/0.1版本手动/非标选品/文档载体表/载体表.md.");
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

    @Override
    public Map<String, Object> listManualCandidates(String marketplace,
                                                    String month,
                                                    int scanLimit,
                                                    int limit,
                                                    String carrier) {
        String normalizedMarketplace = normalizeMarketplace(marketplace);
        int safeScanLimit = normalizeScanLimit(scanLimit);
        int safeLimit = normalizeCandidateLimit(limit);
        List<String> supportedCarriers = productTitleParsingService.listSupportedCarriers();
        String carrierFilter = normalizeCarrierFilter(carrier, supportedCarriers);
        String resolvedMonth = resolveMonthOrNull(normalizedMarketplace, month);
        if (resolvedMonth == null) {
            return emptyManualCandidatesResult(normalizedMarketplace, safeScanLimit, safeLimit, supportedCarriers, carrierFilter);
        }

        List<CompetitorProduct> scannedProducts = loadCandidateProducts(normalizedMarketplace, resolvedMonth, safeScanLimit);
        Map<String, Integer> filteredByReason = new LinkedHashMap<>();
        Map<String, BaselineReference> baselineCache = new LinkedHashMap<>();
        List<Map<String, Object>> items = new ArrayList<>();

        int matchedProducts = 0;
        int keptNonStandardProducts = 0;
        int filteredStandardProducts = 0;
        int baselineResolvedCandidates = 0;
        int subcategoryBaselineResolvedCandidates = 0;

        for (CompetitorProduct product : scannedProducts) {
            ProductTitleParseResult parseResult = productTitleParsingService.parse(product.getTitle());
            if (!parseResult.hasCarrier()) {
                continue;
            }
            if (carrierFilter != null && !carrierFilter.equals(parseResult.carrier())) {
                continue;
            }

            matchedProducts++;
            String filterReason = determineCarrierAuditFilterReason(product, parseResult);
            if (filterReason != null) {
                filteredStandardProducts++;
                filteredByReason.merge(filterReason, 1, Integer::sum);
                continue;
            }

            keptNonStandardProducts++;
            if (items.size() >= safeLimit) {
                continue;
            }

            BaselineReference baselineReference = loadBaselineReference(
                    normalizedMarketplace,
                    resolvedMonth,
                    product,
                    baselineCache
            );
            if (baselineReference.hasBaseline()) {
                baselineResolvedCandidates++;
            }
            if (baselineReference.hasSubcategoryBaseline()) {
                subcategoryBaselineResolvedCandidates++;
            }

            items.add(toManualCandidateRow(items.size() + 1, product, parseResult, baselineReference));
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("marketplace", normalizedMarketplace);
        result.put("month", resolvedMonth);
        result.put("scanLimit", safeScanLimit);
        result.put("limit", safeLimit);
        result.put("carrierSource", "document_bootstrap");
        result.put("carrierSourceNote",
                "Current carrier anchors are bootstrapped from ProductTitleParsingServiceImpl.CARRIER_PATTERNS, " +
                        "which was seeded from docs/选品方法库/补充/载体元素三语映射表.md. " +
                        "Manual maintenance target is selection-agent/0.1版本手动/非标选品/文档载体表/载体表.md.");
        result.put("supportedCarrierCount", supportedCarriers.size());
        result.put("supportedCarriers", supportedCarriers);
        result.put("carrierFilter", carrierFilter);
        result.put("scannedProducts", scannedProducts.size());
        result.put("matchedProducts", matchedProducts);
        result.put("keptNonStandardProducts", keptNonStandardProducts);
        result.put("filteredStandardProducts", filteredStandardProducts);
        result.put("filteredByReason", filteredByReason);
        result.put("baselineResolvedCandidates", baselineResolvedCandidates);
        result.put("subcategoryBaselineResolvedCandidates", subcategoryBaselineResolvedCandidates);
        result.put("total", items.size());
        result.put("items", items);
        return result;
    }

    private String determineNonStandardFilterReason(CompetitorProduct product, ProductTitleParseResult parseResult) {
        String normalizedTitle = normalizeText(product.getTitle());
        String filterReason = matchPhraseFilter(normalizedTitle);
        if (filterReason != null) {
            return filterReason;
        }
        String heuristicReason = determineHeuristicFilterReason(normalizedTitle, parseResult);
        if (heuristicReason != null) {
            return heuristicReason;
        }
        return hasDistinctElementToken(parseResult.element()) ? null : "generic_element_only";
    }

    private String determineCarrierAuditFilterReason(CompetitorProduct product, ProductTitleParseResult parseResult) {
        String normalizedTitle = normalizeText(product.getTitle());
        String filterReason = matchPhraseFilter(normalizedTitle);
        if (filterReason != null) {
            return filterReason;
        }
        return determineHeuristicFilterReason(normalizedTitle, parseResult);
    }

    private String matchPhraseFilter(String normalizedTitle) {
        for (FilterPhraseRule rule : FILTER_RULES) {
            if (rule.matches(normalizedTitle)) {
                return rule.reason();
            }
        }
        return null;
    }

    private String determineHeuristicFilterReason(String normalizedTitle, ProductTitleParseResult parseResult) {
        String normalizedCarrier = normalizeText(parseResult.carrier());
        if (matchesToySetAccessoryNoise(normalizedTitle, normalizedCarrier)) {
            return "toy_set_or_brick_accessory";
        }
        if (matchesSmartwatchBandNoise(normalizedTitle, normalizedCarrier)) {
            return "smartwatch_band_accessory";
        }
        if (matchesPictureFrameNoise(normalizedTitle, normalizedCarrier)) {
            return "picture_frame_display";
        }
        if (matchesGenericWaterBottleNoise(normalizedTitle, normalizedCarrier)) {
            return "generic_sports_bottle";
        }
        if (matchesToyFigureSetNoise(normalizedTitle, normalizedCarrier)) {
            return "toy_figure_set";
        }
        if (matchesBackdropFlagPackNoise(normalizedTitle, normalizedCarrier)) {
            return "backdrop_flag_pack";
        }
        if (matchesLunchBagAccessoryNoise(normalizedTitle, normalizedCarrier)) {
            return "lunch_bag_or_cooler_accessory";
        }
        if (matchesDryBagOrTrackerNoise(normalizedTitle, normalizedCarrier)) {
            return "dry_bag_or_tracker_accessory";
        }
        if (matchesStickerFanSetNoise(normalizedTitle, normalizedCarrier)) {
            return "sticker_fan_set_bundle";
        }
        if (matchesAutomotiveCleaningBundleNoise(normalizedTitle, normalizedCarrier)) {
            return "automotive_cleaning_bundle";
        }
        if (matchesAlbumOrPlannerNoise(normalizedTitle, normalizedCarrier)) {
            return "album_or_planner_collectible";
        }
        if (matchesToyPropHatNoise(normalizedTitle, normalizedCarrier)) {
            return "toy_prop_hat_accessory";
        }
        return null;
    }

    private boolean matchesToySetAccessoryNoise(String normalizedTitle, String normalizedCarrier) {
        if (!containsAny(normalizedTitle, Set.of("playmobil", "lego", "duplo"))) {
            return false;
        }
        return TOY_SET_ACCESSORY_CARRIERS.contains(normalizedCarrier);
    }

    private boolean matchesSmartwatchBandNoise(String normalizedTitle, String normalizedCarrier) {
        if (!"bracelet".equals(normalizedCarrier)) {
            return false;
        }
        return containsAny(normalizedTitle, SMARTWATCH_BAND_PHRASES);
    }

    private boolean matchesPictureFrameNoise(String normalizedTitle, String normalizedCarrier) {
        if (!"poster".equals(normalizedCarrier)) {
            return false;
        }
        return containsAny(normalizedTitle, PICTURE_FRAME_PHRASES);
    }

    private boolean matchesGenericWaterBottleNoise(String normalizedTitle, String normalizedCarrier) {
        if (!"water bottle".equals(normalizedCarrier)) {
            return false;
        }
        return containsAny(normalizedTitle, GENERIC_WATER_BOTTLE_PHRASES);
    }

    private boolean matchesToyFigureSetNoise(String normalizedTitle, String normalizedCarrier) {
        if (!"figure".equals(normalizedCarrier)) {
            return false;
        }
        return containsAny(normalizedTitle, TOY_FIGURE_SET_PHRASES);
    }

    private boolean matchesBackdropFlagPackNoise(String normalizedTitle, String normalizedCarrier) {
        if (!"backdrop".equals(normalizedCarrier)) {
            return false;
        }
        return containsAny(normalizedTitle, BACKDROP_FLAG_PACK_PHRASES);
    }

    private boolean matchesLunchBagAccessoryNoise(String normalizedTitle, String normalizedCarrier) {
        if (!"lunch bag".equals(normalizedCarrier)) {
            return false;
        }
        return containsAny(normalizedTitle, LUNCH_BAG_ACCESSORY_PHRASES);
    }

    private boolean matchesDryBagOrTrackerNoise(String normalizedTitle, String normalizedCarrier) {
        if (!Set.of("towel", "backpack").contains(normalizedCarrier)) {
            return false;
        }
        return containsAny(normalizedTitle, DRY_BAG_OR_TRACKER_PHRASES);
    }

    private boolean matchesStickerFanSetNoise(String normalizedTitle, String normalizedCarrier) {
        if (!"sticker".equals(normalizedCarrier)) {
            return false;
        }
        return containsAny(normalizedTitle, STICKER_FAN_SET_PRIMARY_PHRASES)
                && containsAny(normalizedTitle, STICKER_FAN_SET_SECONDARY_PHRASES);
    }

    private boolean matchesAutomotiveCleaningBundleNoise(String normalizedTitle, String normalizedCarrier) {
        if (!"towel".equals(normalizedCarrier)) {
            return false;
        }
        return containsAny(normalizedTitle, Set.of(
                "chemical guys",
                "degreaser",
                "aerosol cleaner",
                "detailing spray",
                "microfiber towel",
                "drying towel",
                "wash mitt",
                "wheel cleaner",
                "carpet cleaner"
        ));
    }

    private boolean matchesAlbumOrPlannerNoise(String normalizedTitle, String normalizedCarrier) {
        if ("sticker".equals(normalizedCarrier)
                && containsAny(normalizedTitle, Set.of("sticker collection", "album"))) {
            return true;
        }
        return "poster".equals(normalizedCarrier)
                && containsAny(normalizedTitle, Set.of("wall planner", "planner poster"));
    }

    private boolean matchesToyPropHatNoise(String normalizedTitle, String normalizedCarrier) {
        if (!"cap".equals(normalizedCarrier)) {
            return false;
        }
        return containsAny(normalizedTitle, Set.of("mini party hats", "stuffed animal", "toy animals"));
    }

    private boolean containsAny(String normalizedTitle, Set<String> phrases) {
        for (String phrase : phrases) {
            if (normalizedTitle.contains(phrase)) {
                return true;
            }
        }
        return false;
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
        // 数据清洗层：走 selectCleanCandidatesForDiscovery（FROM competitor_products_clean）
        // 避免卖家精灵变体污染：原表里一个父系列 N 个变体的 units/bsr 都重复，会让排序前 N 名都是同一个产品
        return competitorProductMapper.selectCleanCandidatesForDiscovery(marketplace, month, scanLimit);
    }

    private Map<String, Object> toSampleRow(CompetitorProduct product, ProductTitleParseResult parseResult) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("asin", product.getAsin());
        row.put("marketplace", product.getMarketplace());
        row.put("month", product.getMonth());
        row.put("brand", product.getBrand());
        row.put("rawSubCategory", extractLeafSubcategory(product.getNodeLabelPath()));
        row.put("carrier", parseResult.carrier());
        row.put("matchedCarrierAnchor", parseResult.matchedCarrierAnchor());
        row.put("element", parseResult.element());
        row.put("units", product.getUnits());
        row.put("bsr", product.getBsr());
        row.put("price", product.getPrice());
        row.put("title", product.getTitle());
        return row;
    }

    private Map<String, Object> toManualCandidateRow(int rowId,
                                                     CompetitorProduct product,
                                                     ProductTitleParseResult parseResult,
                                                     BaselineReference baselineReference) {
        String rawSubcategory = extractLeafSubcategory(product.getNodeLabelPath());
        String matchedCarrierAnchor = parseResult.matchedCarrierAnchor() == null
                ? parseResult.carrier().toLowerCase(Locale.ROOT)
                : parseResult.matchedCarrierAnchor();

        Map<String, Object> row = new LinkedHashMap<>();
        row.put("row_id", rowId);
        row.put("asin", product.getAsin());
        row.put("marketplace", product.getMarketplace());
        row.put("month", product.getMonth());
        row.put("title", product.getTitle());
        row.put("matched_carrier_anchor", matchedCarrierAnchor);
        row.put("carrier_candidates", parseResult.carrier());
        row.put("carrier_candidates_list", List.of(parseResult.carrier()));
        row.put("category_hint", rawSubcategory);
        row.put("bsr_id", trimToNull(product.getBsrId()));
        row.put("notes", buildManualCandidateNotes(baselineReference));
        row.put("canonical_carrier", parseResult.carrier());
        row.put("element_hint", parseResult.element());
        row.put("brand", trimToNull(product.getBrand()));
        row.put("raw_subcategory", rawSubcategory);
        row.put("units", product.getUnits());
        row.put("bsr", product.getBsr());
        row.put("price", product.getPrice());
        row.put("baseline_has_data", baselineReference.hasBaseline());
        row.put("baseline_month", baselineReference.baselineMonth());
        row.put("baseline_bucket", baselineReference.bsrBucket());
        row.put("baseline_sample_size", baselineReference.sampleSize());
        row.put("baseline_confidence", baselineReference.confidence());
        row.put("baseline_p25", baselineReference.unitsP25());
        row.put("baseline_p50", baselineReference.unitsP50());
        row.put("baseline_p75", baselineReference.unitsP75());
        row.put("baseline_price_avg", baselineReference.priceAvg());
        row.put("sub_baseline_has_data", baselineReference.hasSubcategoryBaseline());
        row.put("sub_baseline_month", baselineReference.subBaselineMonth());
        row.put("sub_baseline_subcategory", baselineReference.subCategory());
        row.put("sub_baseline_sample_size", baselineReference.subSampleSize());
        row.put("sub_baseline_confidence", baselineReference.subConfidence());
        row.put("sub_baseline_p50", baselineReference.subUnitsP50());
        row.put("sub_baseline_p75", baselineReference.subUnitsP75());
        row.put("sub_baseline_p90", baselineReference.subUnitsP90());
        row.put("sub_baseline_price_p50", baselineReference.subPriceP50());
        return row;
    }

    private String resolveMonthOrNull(String marketplace, String month) {
        String normalizedMonth = normalizeMonth(month);
        if (normalizedMonth != null) {
            return normalizedMonth;
        }
        String latestMonth = competitorProductMapper.selectLatestMonth(marketplace);
        if (latestMonth != null && latestMonth.isBlank()) {
            throw new IllegalStateException("competitor_products 没有可用 month 数据");
        }
        return latestMonth;
    }

    private Map<String, Object> emptyPath2Result(String marketplace,
                                                 int scanLimit,
                                                 int topN,
                                                 int minProducts,
                                                 int minTotalUnits) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("marketplace", marketplace);
        result.put("month", null);
        result.put("scanLimit", scanLimit);
        result.put("scannedProducts", 0);
        result.put("parsedProducts", 0);
        result.put("filteredStandardProducts", 0);
        result.put("filteredByReason", Map.of());
        result.put("returnedElements", 0);
        result.put("minProducts", minProducts);
        result.put("minTotalUnits", minTotalUnits);
        result.put("topElements", List.of());
        result.put("samples", List.of());
        result.put("filteredSamples", List.of());
        result.put("dataStatus", "no_month_data");
        result.put("topN", topN);
        return result;
    }

    private Map<String, Object> emptyCarrierMatchResult(String marketplace,
                                                        int scanLimit,
                                                        int topN,
                                                        int samplePerCarrier,
                                                        List<String> supportedCarriers,
                                                        String carrierFilter) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("marketplace", marketplace);
        result.put("month", null);
        result.put("scanLimit", scanLimit);
        result.put("carrierSource", "document_bootstrap");
        result.put("carrierSourceNote",
                "Current carrier anchors are bootstrapped from docs/閫夊搧鏂规硶搴?琛ュ厖/杞戒綋鍏冪礌涓夎鏄犲皠琛?md. " +
                        "Later this should move to a manually maintained selection carrier table.");
        result.put("supportedCarrierCount", supportedCarriers.size());
        result.put("supportedCarriers", supportedCarriers);
        result.put("carrierFilter", carrierFilter);
        result.put("scannedProducts", 0);
        result.put("matchedProducts", 0);
        result.put("matchedCarrierCount", 0);
        result.put("keptNonStandardProducts", 0);
        result.put("filteredStandardProducts", 0);
        result.put("precisionProxy", BigDecimal.ZERO);
        result.put("filteredByReason", Map.of());
        result.put("returnedCarriers", 0);
        result.put("topCarriers", List.of());
        result.put("dataStatus", "no_month_data");
        result.put("topN", topN);
        result.put("samplePerCarrier", samplePerCarrier);
        return result;
    }

    private Map<String, Object> emptyManualCandidatesResult(String marketplace,
                                                            int scanLimit,
                                                            int limit,
                                                            List<String> supportedCarriers,
                                                            String carrierFilter) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("marketplace", marketplace);
        result.put("month", null);
        result.put("scanLimit", scanLimit);
        result.put("limit", limit);
        result.put("carrierSource", "document_bootstrap");
        result.put("carrierSourceNote",
                "Current carrier anchors are bootstrapped from docs/閫夊搧鏂规硶搴?琛ュ厖/杞戒綋鍏冪礌涓夎鏄犲皠琛?md. " +
                        "Later this should move to a manually maintained selection carrier table.");
        result.put("supportedCarrierCount", supportedCarriers.size());
        result.put("supportedCarriers", supportedCarriers);
        result.put("carrierFilter", carrierFilter);
        result.put("scannedProducts", 0);
        result.put("matchedProducts", 0);
        result.put("keptNonStandardProducts", 0);
        result.put("filteredStandardProducts", 0);
        result.put("filteredByReason", Map.of());
        result.put("baselineResolvedCandidates", 0);
        result.put("subcategoryBaselineResolvedCandidates", 0);
        result.put("total", 0);
        result.put("items", List.of());
        result.put("dataStatus", "no_month_data");
        return result;
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

    private int normalizeCandidateLimit(int limit) {
        if (limit <= 0) {
            return DEFAULT_MANUAL_LIMIT;
        }
        return Math.min(limit, MAX_MANUAL_LIMIT);
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

    private BaselineReference loadBaselineReference(String marketplace,
                                                    String month,
                                                    CompetitorProduct product,
                                                    Map<String, BaselineReference> cache) {
        String bsrId = trimToNull(product.getBsrId());
        Integer bsr = product.getBsr();
        String leafSubCategory = extractLeafSubcategory(product.getNodeLabelPath());
        if (bsrId == null || bsr == null || bsr <= 0) {
            return BaselineReference.empty(month, null);
        }

        String bsrBucket = resolveBsrBucket(bsr);
        // cacheKey 包含 leaf — 同 bsr_id 同桶但不同 leaf 的两个商品，小类基线不同
        String cacheKey = marketplace + "|" + month + "|" + bsrId + "|" + bsrBucket
                + "|" + (leafSubCategory == null ? "" : leafSubCategory);
        BaselineReference cached = cache.get(cacheKey);
        if (cached != null) {
            return cached;
        }

        BaselineReference categoryPart;
        try {
            Map<String, Object> data = salesBaselineService.getBsrHealth(marketplace, bsrId, bsr, month);
            categoryPart = BaselineReference.from(data, month, bsrBucket);
        } catch (Exception exception) {
            categoryPart = BaselineReference.empty(month, bsrBucket);
        }

        BaselineReference baselineReference = categoryPart;
        if (leafSubCategory != null) {
            try {
                Map<String, Object> subData = salesBaselineService.getSubcategoryHealth(
                        marketplace, bsrId, leafSubCategory, month);
                baselineReference = baselineReference.withSubcategory(subData);
            } catch (Exception exception) {
                // 小类基线缺失不阻断；保留大类信息
            }
        }
        cache.put(cacheKey, baselineReference);
        return baselineReference;
    }

    private String buildManualCandidateNotes(BaselineReference baselineReference) {
        StringBuilder notes = new StringBuilder("source=carrier_title_match");
        if (!baselineReference.hasBaseline()) {
            notes.append("; baseline=none");
        } else {
            notes.append("; baseline=")
                    .append(baselineReference.baselineMonth() == null ? "" : baselineReference.baselineMonth())
                    .append("/")
                    .append(baselineReference.bsrBucket() == null ? "" : baselineReference.bsrBucket());
            if (baselineReference.unitsP50() != null) {
                notes.append("; units_p50=").append(baselineReference.unitsP50());
            }
            if (baselineReference.unitsP75() != null) {
                notes.append("; units_p75=").append(baselineReference.unitsP75());
            }
            if (baselineReference.confidence() != null) {
                notes.append("; confidence=").append(baselineReference.confidence());
            }
        }
        if (baselineReference.hasSubcategoryBaseline()) {
            notes.append("; sub_baseline=")
                    .append(baselineReference.subBaselineMonth() == null ? "" : baselineReference.subBaselineMonth())
                    .append("/")
                    .append(baselineReference.subCategory() == null ? "" : baselineReference.subCategory());
            if (baselineReference.subUnitsP50() != null) {
                notes.append("; sub_units_p50=").append(baselineReference.subUnitsP50());
            }
            if (baselineReference.subUnitsP75() != null) {
                notes.append("; sub_units_p75=").append(baselineReference.subUnitsP75());
            }
            if (baselineReference.subUnitsP90() != null) {
                notes.append("; sub_units_p90=").append(baselineReference.subUnitsP90());
            }
            if (baselineReference.subConfidence() != null) {
                notes.append("; sub_confidence=").append(baselineReference.subConfidence());
            }
        } else {
            notes.append("; sub_baseline=none");
        }
        return notes.toString();
    }

    private String resolveBsrBucket(Integer bsr) {
        if (bsr == null || bsr <= 0) {
            return null;
        }
        if (bsr < 5000) {
            return "lt5k";
        }
        if (bsr < 20000) {
            return "5k20k";
        }
        if (bsr < 50000) {
            return "20k50k";
        }
        if (bsr < 150000) {
            return "50k150k";
        }
        return "gt150k";
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

    private record BaselineReference(boolean hasBaseline,
                                     String baselineMonth,
                                     String bsrBucket,
                                     Integer sampleSize,
                                     String confidence,
                                     Integer unitsP25,
                                     Integer unitsP50,
                                     Integer unitsP75,
                                     BigDecimal priceAvg,
                                     boolean hasSubcategoryBaseline,
                                     String subBaselineMonth,
                                     String subCategory,
                                     Integer subSampleSize,
                                     String subConfidence,
                                     Integer subUnitsP50,
                                     Integer subUnitsP75,
                                     Integer subUnitsP90,
                                     BigDecimal subPriceP50) {

        private static BaselineReference empty(String baselineMonth, String bsrBucket) {
            return new BaselineReference(false, baselineMonth, bsrBucket, null, null, null, null, null, null,
                    false, null, null, null, null, null, null, null, null);
        }

        @SuppressWarnings("unchecked")
        private static BaselineReference from(Map<String, Object> data, String fallbackMonth, String fallbackBucket) {
            if (data == null || !Boolean.TRUE.equals(data.get("hasBaseline"))) {
                String baselineMonth = valueOrNull(data == null ? null : data.get("baselineMonth"), fallbackMonth);
                String bsrBucket = valueOrNull(data == null ? null : data.get("bsrBucket"), fallbackBucket);
                return empty(baselineMonth, bsrBucket);
            }

            Map<String, Object> units = data.get("units") instanceof Map<?, ?> map
                    ? (Map<String, Object>) map
                    : Map.of();
            String baselineMonth = valueOrNull(data.get("baselineMonth"), fallbackMonth);
            String bsrBucket = valueOrNull(data.get("bsrBucket"), fallbackBucket);
            Object confidence = data.get("confidence");

            return new BaselineReference(
                    true,
                    baselineMonth,
                    bsrBucket,
                    toIntegerStatic(data.get("sampleSize")),
                    confidence == null ? null : String.valueOf(confidence),
                    toIntegerStatic(units.get("p25")),
                    toIntegerStatic(units.get("p50")),
                    toIntegerStatic(units.get("p75")),
                    toBigDecimalStatic(data.get("priceAvg")),
                    false, null, null, null, null, null, null, null, null
            );
        }

        @SuppressWarnings("unchecked")
        private BaselineReference withSubcategory(Map<String, Object> subData) {
            if (subData == null || !Boolean.TRUE.equals(subData.get("hasBaseline"))) {
                return this;
            }
            Map<String, Object> subUnits = subData.get("units") instanceof Map<?, ?> map
                    ? (Map<String, Object>) map
                    : Map.of();
            Object subConfRaw = subData.get("confidence");

            return new BaselineReference(
                    this.hasBaseline,
                    this.baselineMonth,
                    this.bsrBucket,
                    this.sampleSize,
                    this.confidence,
                    this.unitsP25,
                    this.unitsP50,
                    this.unitsP75,
                    this.priceAvg,
                    true,
                    valueOrNull(subData.get("baselineMonth"), this.baselineMonth),
                    valueOrNull(subData.get("subCategory"), null),
                    toIntegerStatic(subData.get("sampleSize")),
                    subConfRaw == null ? null : String.valueOf(subConfRaw),
                    toIntegerStatic(subUnits.get("p50")),
                    toIntegerStatic(subUnits.get("p75")),
                    toIntegerStatic(subUnits.get("p90")),
                    toBigDecimalStatic(subData.get("priceP50"))
            );
        }

        private static Integer toIntegerStatic(Object value) {
            if (value == null) {
                return null;
            }
            if (value instanceof Number number) {
                return number.intValue();
            }
            return Integer.valueOf(String.valueOf(value));
        }

        private static BigDecimal toBigDecimalStatic(Object value) {
            if (value == null) {
                return null;
            }
            if (value instanceof BigDecimal decimal) {
                return decimal;
            }
            if (value instanceof Number number) {
                return BigDecimal.valueOf(number.doubleValue());
            }
            return new BigDecimal(String.valueOf(value));
        }

        private static String valueOrNull(Object value, String fallback) {
            if (value == null) {
                return fallback;
            }
            String normalized = String.valueOf(value).trim();
            return normalized.isEmpty() || "null".equalsIgnoreCase(normalized) ? fallback : normalized;
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
