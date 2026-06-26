package com.sjzm.product.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.toolkit.IdWorker;
import com.sjzm.product.dto.SubcategoryAliasBatchReviewRequest;
import com.sjzm.product.dto.SubcategoryAliasResolution;
import com.sjzm.product.entity.SubcategoryAliasMap;
import com.sjzm.product.mapper.CompetitorProductMapper;
import com.sjzm.product.mapper.SubcategoryAliasMapMapper;
import com.sjzm.product.service.SubcategoryAliasService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class SubcategoryAliasServiceImpl implements SubcategoryAliasService {

    private static final String SOURCE_WINNER = "WINNER";
    private static final String SOURCE_COMPETITOR = "COMPETITOR";
    private static final String STATUS_APPROVED = "APPROVED";
    private static final String STATUS_PENDING = "PENDING";
    private static final String STATUS_REJECTED = "REJECTED";
    private static final String MARKETPLACE_ALL = "ALL";
    private static final String ACTION_APPROVE = "APPROVE";
    private static final String ACTION_REJECT = "REJECT";
    private static final String MATCH_METHOD_MANUAL = "MANUAL";
    private static final String MATCH_METHOD_MANUAL_BATCH = "MANUAL_BATCH";
    private static final String MATCH_METHOD_WINNER_RAW = "WINNER_RAW";
    private static final String MATCH_METHOD_WINNER_EXACT = "WINNER_EXACT";
    private static final String MATCH_METHOD_CATEGORY_RULE = "CATEGORY_RULE";
    private static final Set<String> SUGGESTION_STOP_WORDS = Set.of(
            "and", "for", "the", "with",
            "women", "woman", "men", "man",
            "kids", "kid", "toddlers", "toddler",
            "sets", "set", "kits", "kit",
            "bags", "bag", "covers", "cover",
            "outfits", "clothing", "accessories"
    );

    private static final List<CategoryRule> CATEGORY_RULES = List.of(
            rule("Sun Catcher", List.of("suncatcher", "sun catcher", "glass art", "suncatchers")),
            rule("Figure", List.of("action figure", "figurine", "figure", "playset", "collectible figurines")),
            rule("Canvas Tote", List.of("canvas tote", "canvas bag", "cotton bag")),
            rule("Tote Bag", List.of("tote bag", "women s totes")),
            rule("Cosmetic Bag", List.of("cosmetic bag", "makeup bag")),
            rule("Drawstring Bag", List.of("drawstring bag", "gym bag", "drawstring gym bags")),
            rule("Keychain", List.of("keyring", "key chain", "keychain")),
            rule("Mug", List.of("coffee cup", "coffee cups", "mug")),
            rule("Coin Purse", List.of("coin purse", "change purse")),
            rule("Metal Sign", List.of("metal sign", "tin sign")),
            rule("Poster", List.of("poster", "print", "kunstdruck")),
            rule("Water Bottle", List.of("water bottle", "canteen")),
            rule("Bracelet", List.of("bracelet")),
            rule("Cap", List.of("cap", "baseball cap", "hat")),
            rule("Cake Topper", List.of("cake topper", "cupcake topper")),
            rule("Party Banner", List.of("party banner", "bunting")),
            rule("Greeting Card", List.of("greeting card")),
            rule("Plush", List.of("stuffed animal", "soft doll", "plush")),
            rule("Squeeze Toy", List.of("squeeze toy")),
            rule("Mouse Pad", List.of("mouse pad", "mouse mat")),
            rule("Garden Stake", List.of("garden stake", "outdoor statues")),
            rule("Sticker", List.of("sticker", "stickers", "decal")),
            rule("Diamond Painting", List.of("diamond painting")),
            rule("Tumbler", List.of("tumbler", "travel tumbler")),
            rule("Challenge Coin", List.of("challenge coin")),
            rule("Lunch Bag", List.of("lunch bag", "insulated lunch bag")),
            rule("Towel", List.of("towel", "beach towel")),
            rule("Apron", List.of("apron")),
            rule("Glasses Case", List.of("glasses case", "spectacle case")),
            rule("Backpack", List.of("backpack")),
            rule("Paint by Numbers", List.of("paint by numbers"))
    );

    private final SubcategoryAliasMapMapper subcategoryAliasMapMapper;
    private final CompetitorProductMapper competitorProductMapper;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> bootstrap(String month, String marketplace) {
        String normalizedMarketplace = normalizeMarketplace(marketplace);
        String baselineMonth = resolveBaselineMonth(month, normalizedMarketplace);

        List<SubcategoryAliasMap> existingAliases = subcategoryAliasMapMapper.selectList(
                new LambdaQueryWrapper<SubcategoryAliasMap>()
        );
        Map<String, SubcategoryAliasMap> existingIndex = existingAliases.stream()
                .collect(Collectors.toMap(this::buildIndexKey, Function.identity(), (left, right) -> left, LinkedHashMap::new));

        List<SubcategoryAliasMap> winnerAliases = buildWinnerAliases(existingIndex);
        int approvedWinner = countByStatus(winnerAliases, STATUS_APPROVED);
        int pendingWinner = countByStatus(winnerAliases, STATUS_PENDING);

        Map<String, SubcategoryAliasMap> winnerNormalizedIndex = winnerAliases.stream()
                .filter(alias -> STATUS_APPROVED.equals(alias.getStatus()))
                .collect(Collectors.toMap(
                        SubcategoryAliasMap::getNormalizedSubcategory,
                        Function.identity(),
                        this::preferHigherSample,
                        LinkedHashMap::new
                ));
        List<SubcategoryAliasMap> approvedWinnerAliases = winnerAliases.stream()
                .filter(alias -> STATUS_APPROVED.equals(alias.getStatus()))
                .toList();

        List<SubcategoryAliasMap> competitorAliases = buildCompetitorAliases(
                baselineMonth,
                normalizedMarketplace,
                existingIndex,
                winnerNormalizedIndex,
                approvedWinnerAliases
        );
        int approvedCompetitor = countByStatus(competitorAliases, STATUS_APPROVED);
        int pendingCompetitor = countByStatus(competitorAliases, STATUS_PENDING);

        for (SubcategoryAliasMap alias : winnerAliases) {
            subcategoryAliasMapMapper.upsert(alias);
        }
        for (SubcategoryAliasMap alias : competitorAliases) {
            subcategoryAliasMapMapper.upsert(alias);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("baselineMonth", baselineMonth);
        result.put("marketplace", normalizedMarketplace == null ? MARKETPLACE_ALL : normalizedMarketplace);
        result.put("winnerAliases", winnerAliases.size());
        result.put("approvedWinnerAliases", approvedWinner);
        result.put("pendingWinnerAliases", pendingWinner);
        result.put("winnerCanonicalKeys", approvedWinnerAliases.stream()
                .map(SubcategoryAliasMap::getCanonicalKey)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet())
                .size());
        result.put("competitorAliases", competitorAliases.size());
        result.put("approvedCompetitorAliases", approvedCompetitor);
        result.put("pendingCompetitorAliases", pendingCompetitor);
        return result;
    }

    @Override
    public SubcategoryAliasResolution resolve(String marketplace, String rawOrCanonical) {
        String normalizedMarketplace = normalizeMarketplace(marketplace);
        String normalizedQuery = normalizeText(rawOrCanonical);
        if (normalizedQuery == null) {
            return null;
        }

        List<SubcategoryAliasMap> approvedAliases = subcategoryAliasMapMapper.selectList(
                new LambdaQueryWrapper<SubcategoryAliasMap>()
                        .eq(SubcategoryAliasMap::getStatus, STATUS_APPROVED)
                        .and(wrapper -> wrapper
                                .eq(SubcategoryAliasMap::getNormalizedSubcategory, normalizedQuery)
                                .or()
                                .eq(SubcategoryAliasMap::getCanonicalKey, normalizedQuery.replace(' ', '_'))
                                .or()
                                .eq(SubcategoryAliasMap::getCanonicalName, rawOrCanonical))
        );

        if (approvedAliases.isEmpty()) {
            return null;
        }

        return approvedAliases.stream()
                .filter(alias -> SOURCE_COMPETITOR.equals(alias.getSourceType())
                        && normalizedMarketplace != null
                        && normalizedMarketplace.equals(alias.getMarketplace()))
                .findFirst()
                .or(() -> approvedAliases.stream()
                        .filter(alias -> SOURCE_WINNER.equals(alias.getSourceType()))
                        .findFirst())
                .or(() -> approvedAliases.stream()
                        .filter(alias -> SOURCE_COMPETITOR.equals(alias.getSourceType()))
                        .findFirst())
                .map(alias -> new SubcategoryAliasResolution(
                        alias.getCanonicalKey(),
                        alias.getCanonicalName(),
                        alias.getSourceType(),
                        alias.getRawSubcategory(),
                        alias.getMatchMethod()
                ))
                .orElse(null);
    }

    @Override
    public List<Map<String, Object>> listPending(String sourceType, String marketplace, int limit) {
        String normalizedSourceType = trimToNull(sourceType) == null
                ? SOURCE_COMPETITOR
                : normalizeSourceType(sourceType);
        String normalizedMarketplace = SOURCE_WINNER.equals(normalizedSourceType)
                ? MARKETPLACE_ALL
                : normalizeMarketplace(marketplace);
        int safeLimit = limit <= 0 ? 50 : Math.min(limit, 200);

        List<SubcategoryAliasMap> rows = queryPendingAliases(normalizedSourceType, normalizedMarketplace, safeLimit);
        List<Map<String, Object>> result = new ArrayList<>(rows.size());
        for (SubcategoryAliasMap row : rows) {
            result.add(toPendingItem(row));
        }
        return result;
    }

    @Override
    public List<Map<String, Object>> listReviewCandidates(String sourceType,
                                                          String marketplace,
                                                          int limit,
                                                          int suggestionLimit) {
        String normalizedSourceType = trimToNull(sourceType) == null
                ? SOURCE_COMPETITOR
                : normalizeSourceType(sourceType);
        String normalizedMarketplace = SOURCE_WINNER.equals(normalizedSourceType)
                ? MARKETPLACE_ALL
                : normalizeMarketplace(marketplace);
        int safeLimit = limit <= 0 ? 20 : Math.min(limit, 100);
        int safeSuggestionLimit = suggestionLimit <= 0 ? 3 : Math.min(suggestionLimit, 5);
        int scanLimit = Math.min(Math.max(safeLimit * 20, safeLimit), 1000);

        List<SubcategoryAliasMap> pendingAliases = queryPendingAliases(normalizedSourceType, normalizedMarketplace, scanLimit);
        List<SubcategoryAliasMap> approvedWinnerAliases = listApprovedWinnerAliases();

        return pendingAliases.stream()
                .map(alias -> toReviewCandidateItem(alias, approvedWinnerAliases, safeSuggestionLimit))
                .filter(item -> !((List<?>) item.get("suggestions")).isEmpty())
                .limit(safeLimit)
                .toList();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> approve(String sourceType,
                                       String marketplace,
                                       String rawSubcategory,
                                       String canonicalKey,
                                       String canonicalName,
                                       String carrierHint,
                                       String notes) {
        SubcategoryAliasMap alias = reviewAlias(
                normalizeSourceType(sourceType),
                normalizeAliasMarketplace(normalizeSourceType(sourceType), marketplace),
                requireText(rawSubcategory, "rawSubcategory 不能为空"),
                requireText(canonicalKey, "canonicalKey 不能为空"),
                requireText(canonicalName, "canonicalName 不能为空"),
                trimToNull(carrierHint),
                trimToNull(notes),
                STATUS_APPROVED,
                MATCH_METHOD_MANUAL
        );

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("sourceType", alias.getSourceType());
        result.put("marketplace", alias.getMarketplace());
        result.put("rawSubcategory", alias.getRawSubcategory());
        result.put("canonicalKey", alias.getCanonicalKey());
        result.put("canonicalName", alias.getCanonicalName());
        result.put("status", alias.getStatus());
        result.put("matchMethod", alias.getMatchMethod());
        return result;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> batchReview(SubcategoryAliasBatchReviewRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("request 不能为空");
        }

        String action = normalizeAction(request.getAction());
        String sourceType = trimToNull(request.getSourceType()) == null
                ? SOURCE_COMPETITOR
                : normalizeSourceType(request.getSourceType());
        String marketplace = normalizeAliasMarketplace(sourceType, request.getMarketplace());
        List<String> rawSubcategories = normalizeRawSubcategories(request.getRawSubcategories());
        if (rawSubcategories.isEmpty()) {
            throw new IllegalArgumentException("rawSubcategories 不能为空");
        }

        String canonicalKey = trimToNull(request.getCanonicalKey());
        String canonicalName = trimToNull(request.getCanonicalName());
        if (ACTION_APPROVE.equals(action)) {
            canonicalKey = requireText(canonicalKey, "canonicalKey 不能为空");
            canonicalName = requireText(canonicalName, "canonicalName 不能为空");
        }

        int approvedCount = 0;
        int rejectedCount = 0;
        for (String rawSubcategory : rawSubcategories) {
            if (ACTION_APPROVE.equals(action)) {
                reviewAlias(
                        sourceType,
                        marketplace,
                        rawSubcategory,
                        canonicalKey,
                        canonicalName,
                        trimToNull(request.getCarrierHint()),
                        trimToNull(request.getNotes()),
                        STATUS_APPROVED,
                        MATCH_METHOD_MANUAL_BATCH
                );
                approvedCount++;
            } else {
                reviewAlias(
                        sourceType,
                        marketplace,
                        rawSubcategory,
                        null,
                        null,
                        trimToNull(request.getCarrierHint()),
                        trimToNull(request.getNotes()),
                        STATUS_REJECTED,
                        MATCH_METHOD_MANUAL_BATCH
                );
                rejectedCount++;
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("action", action);
        result.put("sourceType", sourceType);
        result.put("marketplace", marketplace);
        result.put("reviewedCount", rawSubcategories.size());
        result.put("approvedCount", approvedCount);
        result.put("rejectedCount", rejectedCount);
        result.put("canonicalKey", canonicalKey);
        result.put("canonicalName", canonicalName);
        result.put("rawSubcategories", rawSubcategories);
        return result;
    }

    private List<SubcategoryAliasMap> buildWinnerAliases(Map<String, SubcategoryAliasMap> existingIndex) {
        List<Map<String, Object>> winnerSeeds = subcategoryAliasMapMapper.selectWinnerSubcategorySeeds();
        List<SubcategoryAliasMap> aliases = new ArrayList<>(winnerSeeds.size());
        for (Map<String, Object> row : winnerSeeds) {
            String rawSubcategory = asString(row.get("rawSubcategory"));
            if (rawSubcategory == null) {
                continue;
            }

            String carrierHint = asString(row.get("carrierHint"));
            SubcategoryAliasMap candidate = newAlias(
                    SOURCE_WINNER,
                    MARKETPLACE_ALL,
                    rawSubcategory,
                    carrierHint,
                    asInteger(row.get("sampleCount")),
                    null,
                    toCanonicalKey(rawSubcategory),
                    rawSubcategory,
                    MATCH_METHOD_WINNER_RAW,
                    STATUS_APPROVED,
                    carrierHint == null ? "缺少标题载体上下文，仅作为方向种子" : null
            );
            aliases.add(preserveExistingDecision(existingIndex.get(buildIndexKey(candidate)), candidate));
        }
        return aliases;
    }

    private List<SubcategoryAliasMap> buildCompetitorAliases(String baselineMonth,
                                                             String marketplace,
                                                             Map<String, SubcategoryAliasMap> existingIndex,
                                                             Map<String, SubcategoryAliasMap> winnerNormalizedIndex,
                                                             List<SubcategoryAliasMap> approvedWinnerAliases) {
        List<Map<String, Object>> competitorSeeds = subcategoryAliasMapMapper.selectCompetitorLeafSeeds(baselineMonth, marketplace);
        List<SubcategoryAliasMap> aliases = new ArrayList<>(competitorSeeds.size());
        for (Map<String, Object> row : competitorSeeds) {
            String rawSubcategory = asString(row.get("rawSubcategory"));
            String competitorMarketplace = asString(row.get("marketplace"));
            if (rawSubcategory == null || competitorMarketplace == null) {
                continue;
            }

            String normalized = normalizeText(rawSubcategory);
            SubcategoryAliasMap winnerExact = winnerNormalizedIndex.get(normalized);
            CanonicalMatch canonicalMatch = null;
            String status = STATUS_PENDING;
            String notes = "需要人工确认方向 canonical";

            if (winnerExact != null) {
                canonicalMatch = new CanonicalMatch(
                        winnerExact.getCanonicalKey(),
                        winnerExact.getCanonicalName(),
                        MATCH_METHOD_WINNER_EXACT
                );
                status = STATUS_APPROVED;
                notes = null;
            } else {
                CategoryRule categoryRule = matchByCategory(rawSubcategory);
                WinnerDirectionMatch directionMatch = findWinnerDirectionByRule(categoryRule, approvedWinnerAliases);
                if (directionMatch != null && directionMatch.unique()) {
                    canonicalMatch = new CanonicalMatch(
                            directionMatch.alias().getCanonicalKey(),
                            directionMatch.alias().getCanonicalName(),
                            MATCH_METHOD_CATEGORY_RULE
                    );
                    status = STATUS_APPROVED;
                    notes = null;
                } else if (directionMatch != null) {
                    notes = "命中多个赢家方向，请人工确认";
                }
            }

            SubcategoryAliasMap candidate = newAlias(
                    SOURCE_COMPETITOR,
                    competitorMarketplace,
                    rawSubcategory,
                    null,
                    asInteger(row.get("sampleCount")),
                    baselineMonth,
                    canonicalMatch == null ? null : canonicalMatch.canonicalKey(),
                    canonicalMatch == null ? null : canonicalMatch.canonicalName(),
                    canonicalMatch == null ? STATUS_PENDING : canonicalMatch.matchMethod(),
                    status,
                    notes
            );
            aliases.add(preserveExistingDecision(existingIndex.get(buildIndexKey(candidate)), candidate));
        }
        return aliases;
    }

    private SubcategoryAliasMap preserveExistingDecision(SubcategoryAliasMap existing, SubcategoryAliasMap candidate) {
        if (existing == null) {
            return candidate;
        }

        if (STATUS_REJECTED.equals(existing.getStatus()) || isManualDecision(existing)) {
            existing.setSampleCount(candidate.getSampleCount());
            existing.setLatestMonth(candidate.getLatestMonth());
            if (candidate.getCarrierHint() != null) {
                existing.setCarrierHint(candidate.getCarrierHint());
            }
            existing.setUpdatedAt(LocalDateTime.now());
            return existing;
        }

        candidate.setId(existing.getId());
        if (existing.getCreatedAt() != null) {
            candidate.setCreatedAt(existing.getCreatedAt());
        }
        return candidate;
    }

    private SubcategoryAliasMap reviewAlias(String sourceType,
                                            String marketplace,
                                            String rawSubcategory,
                                            String canonicalKey,
                                            String canonicalName,
                                            String carrierHint,
                                            String notes,
                                            String status,
                                            String matchMethod) {
        SubcategoryAliasMap existing = findExistingAlias(sourceType, marketplace, rawSubcategory);
        LocalDateTime now = LocalDateTime.now();

        SubcategoryAliasMap alias = new SubcategoryAliasMap();
        alias.setId(existing != null ? existing.getId() : IdWorker.getId());
        alias.setSourceType(sourceType);
        alias.setMarketplace(marketplace);
        alias.setRawSubcategory(rawSubcategory);
        alias.setNormalizedSubcategory(normalizeText(rawSubcategory));
        alias.setCanonicalKey(STATUS_APPROVED.equals(status) ? normalizeCanonicalKey(canonicalKey) : null);
        alias.setCanonicalName(STATUS_APPROVED.equals(status) ? canonicalName : null);
        alias.setCarrierHint(carrierHint != null ? carrierHint : existing == null ? null : existing.getCarrierHint());
        alias.setSampleCount(existing != null && existing.getSampleCount() != null ? existing.getSampleCount() : 0);
        alias.setLatestMonth(existing == null ? null : existing.getLatestMonth());
        alias.setMatchMethod(matchMethod);
        alias.setStatus(status);
        alias.setNotes(notes);
        alias.setDeleted(0);
        alias.setCreatedAt(existing != null && existing.getCreatedAt() != null ? existing.getCreatedAt() : now);
        alias.setUpdatedAt(now);
        subcategoryAliasMapMapper.upsert(alias);
        return alias;
    }

    private SubcategoryAliasMap findExistingAlias(String sourceType, String marketplace, String rawSubcategory) {
        return subcategoryAliasMapMapper.selectOne(
                new LambdaQueryWrapper<SubcategoryAliasMap>()
                        .eq(SubcategoryAliasMap::getSourceType, sourceType)
                        .eq(SubcategoryAliasMap::getMarketplace, marketplace)
                        .eq(SubcategoryAliasMap::getRawSubcategory, rawSubcategory)
        );
    }

    private SubcategoryAliasMap newAlias(String sourceType,
                                         String marketplace,
                                         String rawSubcategory,
                                         String carrierHint,
                                         Integer sampleCount,
                                         String latestMonth,
                                         String canonicalKey,
                                         String canonicalName,
                                         String matchMethod,
                                         String status,
                                         String notes) {
        SubcategoryAliasMap alias = new SubcategoryAliasMap();
        alias.setId(IdWorker.getId());
        alias.setSourceType(sourceType);
        alias.setMarketplace(marketplace);
        alias.setRawSubcategory(rawSubcategory);
        alias.setNormalizedSubcategory(normalizeText(rawSubcategory));
        alias.setCanonicalKey(canonicalKey == null ? null : normalizeCanonicalKey(canonicalKey));
        alias.setCanonicalName(canonicalName);
        alias.setCarrierHint(trimToNull(carrierHint));
        alias.setSampleCount(sampleCount == null ? 0 : sampleCount);
        alias.setLatestMonth(latestMonth);
        alias.setMatchMethod(matchMethod);
        alias.setStatus(status);
        alias.setNotes(notes);
        alias.setDeleted(0);
        alias.setCreatedAt(LocalDateTime.now());
        alias.setUpdatedAt(LocalDateTime.now());
        return alias;
    }

    private CategoryRule matchByCategory(String rawSubcategory) {
        String normalizedRaw = normalizeText(rawSubcategory);
        if (normalizedRaw == null) {
            return null;
        }

        for (CategoryRule rule : CATEGORY_RULES) {
            if (rule.categoryKeywords().stream().anyMatch(keyword -> comparableContains(normalizedRaw, keyword))) {
                return rule;
            }
        }
        return null;
    }

    private WinnerDirectionMatch findWinnerDirectionByRule(CategoryRule categoryRule,
                                                           List<SubcategoryAliasMap> approvedWinnerAliases) {
        if (categoryRule == null || approvedWinnerAliases == null || approvedWinnerAliases.isEmpty()) {
            return null;
        }

        List<SubcategoryAliasMap> matchedWinners = approvedWinnerAliases.stream()
                .filter(alias -> alias.getNormalizedSubcategory() != null)
                .filter(alias -> categoryRule.categoryKeywords().stream()
                        .anyMatch(keyword -> comparableContains(alias.getNormalizedSubcategory(), keyword)))
                .sorted((left, right) -> Integer.compare(
                        right.getSampleCount() == null ? 0 : right.getSampleCount(),
                        left.getSampleCount() == null ? 0 : left.getSampleCount()))
                .toList();

        if (matchedWinners.isEmpty()) {
            return null;
        }
        return new WinnerDirectionMatch(matchedWinners.get(0), matchedWinners.size() == 1);
    }

    private List<SubcategoryAliasMap> queryPendingAliases(String sourceType, String marketplace, int limit) {
        LambdaQueryWrapper<SubcategoryAliasMap> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SubcategoryAliasMap::getSourceType, sourceType)
                .eq(SubcategoryAliasMap::getStatus, STATUS_PENDING);
        if (marketplace != null) {
            wrapper.eq(SubcategoryAliasMap::getMarketplace, marketplace);
        }
        wrapper.orderByDesc(SubcategoryAliasMap::getSampleCount)
                .orderByAsc(SubcategoryAliasMap::getRawSubcategory)
                .last("LIMIT " + limit);
        return subcategoryAliasMapMapper.selectList(wrapper);
    }

    private List<SubcategoryAliasMap> listApprovedWinnerAliases() {
        return subcategoryAliasMapMapper.selectList(
                new LambdaQueryWrapper<SubcategoryAliasMap>()
                        .eq(SubcategoryAliasMap::getSourceType, SOURCE_WINNER)
                        .eq(SubcategoryAliasMap::getStatus, STATUS_APPROVED)
                        .eq(SubcategoryAliasMap::getDeleted, 0)
                        .isNotNull(SubcategoryAliasMap::getCanonicalKey)
        );
    }

    private Map<String, Object> toPendingItem(SubcategoryAliasMap row) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("sourceType", row.getSourceType());
        item.put("marketplace", row.getMarketplace());
        item.put("rawSubcategory", row.getRawSubcategory());
        item.put("sampleCount", row.getSampleCount());
        item.put("latestMonth", row.getLatestMonth());
        item.put("carrierHint", row.getCarrierHint());
        item.put("canonicalKey", row.getCanonicalKey());
        item.put("canonicalName", row.getCanonicalName());
        item.put("notes", row.getNotes());
        return item;
    }

    private Map<String, Object> toReviewCandidateItem(SubcategoryAliasMap row,
                                                      List<SubcategoryAliasMap> approvedWinnerAliases,
                                                      int suggestionLimit) {
        Map<String, Object> item = toPendingItem(row);
        item.put("suggestions", buildSuggestions(row.getRawSubcategory(), approvedWinnerAliases, suggestionLimit));
        return item;
    }

    private List<Map<String, Object>> buildSuggestions(String rawSubcategory,
                                                       List<SubcategoryAliasMap> approvedWinnerAliases,
                                                       int suggestionLimit) {
        String normalizedRaw = normalizeText(rawSubcategory);
        if (normalizedRaw == null || approvedWinnerAliases == null || approvedWinnerAliases.isEmpty()) {
            return List.of();
        }

        CategoryRule categoryRule = matchByCategory(rawSubcategory);
        Set<String> rawTokens = extractMeaningfulTokens(normalizedRaw);

        return approvedWinnerAliases.stream()
                .map(alias -> scoreSuggestion(normalizedRaw, rawTokens, categoryRule, alias))
                .filter(Objects::nonNull)
                .sorted(Comparator
                        .comparingInt(SuggestionCandidate::score).reversed()
                        .thenComparingInt(candidate -> candidate.winnerSampleCount() == null ? 0 : candidate.winnerSampleCount())
                        .reversed()
                        .thenComparing(SuggestionCandidate::canonicalName))
                .limit(suggestionLimit)
                .map(candidate -> {
                    Map<String, Object> suggestion = new LinkedHashMap<>();
                    suggestion.put("canonicalKey", candidate.canonicalKey());
                    suggestion.put("canonicalName", candidate.canonicalName());
                    suggestion.put("winnerRawSubcategory", candidate.winnerRawSubcategory());
                    suggestion.put("winnerCarrierHint", candidate.winnerCarrierHint());
                    suggestion.put("winnerSampleCount", candidate.winnerSampleCount());
                    suggestion.put("score", candidate.score());
                    suggestion.put("reasons", candidate.reasons());
                    return suggestion;
                })
                .toList();
    }

    private SuggestionCandidate scoreSuggestion(String normalizedRaw,
                                                Set<String> rawTokens,
                                                CategoryRule categoryRule,
                                                SubcategoryAliasMap winnerAlias) {
        String winnerNormalized = winnerAlias.getNormalizedSubcategory();
        if (winnerNormalized == null) {
            return null;
        }

        int score = 0;
        List<String> reasons = new ArrayList<>();

        if (normalizedRaw.equals(winnerNormalized)) {
            score = 100;
            reasons.add("WINNER_EXACT");
        }

        if (comparableContains(normalizedRaw, winnerNormalized) || comparableContains(winnerNormalized, normalizedRaw)) {
            score = Math.max(score, 85);
            reasons.add("TEXT_CONTAINS");
        }

        if (categoryRule != null && hasCategoryRuleMatch(categoryRule, winnerNormalized)) {
            score = Math.max(score, 78);
            reasons.add("CATEGORY_RULE");
        }

        int overlapCount = overlapCount(rawTokens, extractMeaningfulTokens(winnerNormalized));
        if (overlapCount >= 2) {
            score = Math.max(score, 70 + Math.min(overlapCount, 5));
            reasons.add("TOKEN_OVERLAP_" + overlapCount);
        }

        if (score < 60) {
            return null;
        }

        return new SuggestionCandidate(
                winnerAlias.getCanonicalKey(),
                winnerAlias.getCanonicalName(),
                winnerAlias.getRawSubcategory(),
                winnerAlias.getCarrierHint(),
                winnerAlias.getSampleCount(),
                score,
                new ArrayList<>(new LinkedHashSet<>(reasons))
        );
    }

    private boolean hasCategoryRuleMatch(CategoryRule categoryRule, String normalizedWinner) {
        return categoryRule.categoryKeywords().stream()
                .anyMatch(keyword -> comparableContains(normalizedWinner, keyword));
    }

    private Set<String> extractMeaningfulTokens(String normalizedText) {
        if (normalizedText == null) {
            return Set.of();
        }
        return java.util.Arrays.stream(normalizedText.split("\\s+"))
                .map(String::trim)
                .filter(token -> !token.isBlank())
                .filter(token -> token.length() >= 3)
                .filter(token -> !SUGGESTION_STOP_WORDS.contains(token))
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private int overlapCount(Set<String> left, Set<String> right) {
        if (left.isEmpty() || right.isEmpty()) {
            return 0;
        }
        int count = 0;
        for (String token : left) {
            if (right.contains(token)) {
                count++;
            }
        }
        return count;
    }

    private int countByStatus(List<SubcategoryAliasMap> aliases, String status) {
        return (int) aliases.stream()
                .filter(alias -> status.equals(alias.getStatus()))
                .count();
    }

    private boolean isManualDecision(SubcategoryAliasMap alias) {
        String matchMethod = alias.getMatchMethod();
        return matchMethod != null && matchMethod.startsWith("MANUAL");
    }

    private SubcategoryAliasMap preferHigherSample(SubcategoryAliasMap left, SubcategoryAliasMap right) {
        int leftCount = left.getSampleCount() == null ? 0 : left.getSampleCount();
        int rightCount = right.getSampleCount() == null ? 0 : right.getSampleCount();
        return rightCount > leftCount ? right : left;
    }

    private List<String> normalizeRawSubcategories(List<String> rawSubcategories) {
        if (rawSubcategories == null) {
            return List.of();
        }
        return new ArrayList<>(rawSubcategories.stream()
                .map(this::trimToNull)
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new)));
    }

    private String resolveBaselineMonth(String month, String marketplace) {
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

    private String buildIndexKey(SubcategoryAliasMap alias) {
        return alias.getSourceType() + "|" + alias.getMarketplace() + "|" + alias.getRawSubcategory();
    }

    private String normalizeAction(String action) {
        String normalized = requireText(action, "action 不能为空").toUpperCase(Locale.ROOT);
        if (!ACTION_APPROVE.equals(normalized) && !ACTION_REJECT.equals(normalized)) {
            throw new IllegalArgumentException("action 只支持 APPROVE / REJECT");
        }
        return normalized;
    }

    private String normalizeSourceType(String sourceType) {
        String normalized = requireText(sourceType, "sourceType 不能为空").toUpperCase(Locale.ROOT);
        if (!SOURCE_WINNER.equals(normalized) && !SOURCE_COMPETITOR.equals(normalized)) {
            throw new IllegalArgumentException("sourceType 只支持 WINNER / COMPETITOR");
        }
        return normalized;
    }

    private String normalizeAliasMarketplace(String sourceType, String marketplace) {
        if (SOURCE_WINNER.equals(sourceType)) {
            return MARKETPLACE_ALL;
        }
        String normalized = normalizeMarketplace(marketplace);
        if (normalized == null) {
            throw new IllegalArgumentException("COMPETITOR alias 必须传 marketplace");
        }
        return normalized;
    }

    private String normalizeMarketplace(String marketplace) {
        String value = trimToNull(marketplace);
        return value == null ? null : value.toUpperCase(Locale.ROOT);
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

    private String normalizeText(String value) {
        String trimmed = trimToNull(value);
        if (trimmed == null) {
            return null;
        }
        String normalized = Normalizer.normalize(trimmed, Normalizer.Form.NFKC)
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^\\p{IsAlphabetic}\\p{IsDigit}]+", " ")
                .trim()
                .replaceAll("\\s+", " ");
        return normalized.isEmpty() ? null : normalized;
    }

    private String normalizeCanonicalKey(String value) {
        return toCanonicalKey(requireText(value, "canonicalKey 不能为空"));
    }

    private String toCanonicalKey(String value) {
        String normalized = normalizeText(value);
        if (normalized == null) {
            throw new IllegalArgumentException("canonicalKey 不能为空");
        }
        return normalized.replace(' ', '_');
    }

    private String requireText(String value, String message) {
        String trimmed = trimToNull(value);
        if (trimmed == null) {
            throw new IllegalArgumentException(message);
        }
        return trimmed;
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String asString(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private Integer asInteger(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number number) {
            return number.intValue();
        }
        return Integer.valueOf(String.valueOf(value));
    }

    private boolean comparableContains(String normalizedText, String normalizedKeyword) {
        if (normalizedText == null || normalizedKeyword == null) {
            return false;
        }
        String textComparable = normalizedText.replace(" ", "");
        String keywordComparable = normalizedKeyword.replace(" ", "");
        return textComparable.contains(keywordComparable);
    }

    private static CategoryRule rule(String familyName, List<String> categoryKeywords) {
        return new CategoryRule(
                familyName,
                categoryKeywords.stream().map(SubcategoryAliasServiceImpl::normalizeRuleKeyword).toList()
        );
    }

    private static String normalizeRuleKeyword(String keyword) {
        return Normalizer.normalize(keyword, Normalizer.Form.NFKC)
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^\\p{IsAlphabetic}\\p{IsDigit}]+", " ")
                .trim()
                .replaceAll("\\s+", " ");
    }

    private record CategoryRule(String familyName,
                                List<String> categoryKeywords) {
    }

    private record WinnerDirectionMatch(SubcategoryAliasMap alias, boolean unique) {
    }

    private record CanonicalMatch(String canonicalKey, String canonicalName, String matchMethod) {
    }

    private record SuggestionCandidate(String canonicalKey,
                                       String canonicalName,
                                       String winnerRawSubcategory,
                                       String winnerCarrierHint,
                                       Integer winnerSampleCount,
                                       int score,
                                       List<String> reasons) {
    }
}
