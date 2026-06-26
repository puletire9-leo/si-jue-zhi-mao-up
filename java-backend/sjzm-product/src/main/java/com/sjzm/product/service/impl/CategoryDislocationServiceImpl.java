package com.sjzm.product.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.sjzm.product.dto.SubcategoryAliasResolution;
import com.sjzm.product.dto.WinnerTypeSummary;
import com.sjzm.product.entity.CategoryDislocation;
import com.sjzm.product.mapper.CategoryDislocationMapper;
import com.sjzm.product.mapper.CompetitorProductMapper;
import com.sjzm.product.service.CategoryDislocationService;
import com.sjzm.product.service.SubcategoryAliasService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class CategoryDislocationServiceImpl implements CategoryDislocationService {

    private static final String SIGNAL_GREEN = "GREEN";
    private static final String SIGNAL_YELLOW = "YELLOW";
    private static final String SIGNAL_RED = "RED";
    private static final String SIGNAL_COLD = "COLD";
    private static final String SIGNAL_ALL = "ALL";

    private final CategoryDislocationMapper categoryDislocationMapper;
    private final CompetitorProductMapper competitorProductMapper;
    private final SubcategoryAliasService subcategoryAliasService;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> computeDislocation(String month, String marketplace) {
        String normalizedMarketplace = normalizeMarketplace(marketplace);
        String baselineMonth = resolveBaselineMonth(month, normalizedMarketplace);
        Map<String, Object> aliasBootstrap = subcategoryAliasService.bootstrap(baselineMonth, normalizedMarketplace);

        int deleted = categoryDislocationMapper.deleteByBaselineMonth(baselineMonth, normalizedMarketplace);
        int inserted = categoryDislocationMapper.insertComputedSlices(baselineMonth, normalizedMarketplace);
        long totalRows = countRows(baselineMonth, normalizedMarketplace);

        log.info("②线 category_dislocation 计算完成: month={}, marketplace={}, deleted={}, inserted={}, totalRows={}",
                baselineMonth, normalizedMarketplace, deleted, inserted, totalRows);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("success", inserted > 0);
        result.put("baselineMonth", baselineMonth);
        result.put("marketplace", displayMarketplace(normalizedMarketplace));
        result.put("aliasBootstrap", aliasBootstrap);
        result.put("deleted", deleted);
        result.put("inserted", inserted);
        result.put("totalRows", totalRows);
        if (inserted == 0) {
            result.put("message", "当前 approved competitor alias 范围内没有可计算的错位样本");
        }
        return result;
    }

    @Override
    public Map<String, Object> getSignalHealth(String marketplace, String subCategory, String month) {
        String normalizedMarketplace = normalizeRequiredMarketplace(marketplace);
        String normalizedSubCategory = requireText(subCategory, "subCategory / sub_category 不能为空");
        String baselineMonth = normalizeMonth(month);
        String normalizedCanonicalKey = normalizeCanonicalKey(normalizedSubCategory);

        CategoryDislocation row = selectHealthRow(
                normalizedMarketplace,
                normalizedSubCategory,
                normalizedCanonicalKey,
                baselineMonth
        );
        String resolvedBy = "DIRECT";
        String matchedRawSubCategory = normalizedSubCategory;

        if (row == null) {
            SubcategoryAliasResolution resolution = subcategoryAliasService.resolve(normalizedMarketplace, normalizedSubCategory);
            if (resolution != null) {
                resolvedBy = resolution.matchMethod();
                matchedRawSubCategory = resolution.matchedRawSubcategory();
                row = selectHealthRowByCanonicalKey(normalizedMarketplace, resolution.canonicalKey(), baselineMonth);
            }
        }

        if (row == null) {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("hasSignal", false);
            result.put("marketplace", normalizedMarketplace);
            result.put("subCategory", normalizedSubCategory);
            result.put("baselineMonth", baselineMonth);
            return result;
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("hasSignal", true);
        result.put("marketplace", normalizedMarketplace);
        result.put("bsrId", row.getBsrId());
        result.put("canonicalKey", row.getCanonicalKey());
        result.put("subCategory", row.getSubCategory());
        result.put("querySubCategory", normalizedSubCategory);
        result.put("matchedRawSubCategory", matchedRawSubCategory);
        result.put("resolvedBy", resolvedBy);
        result.put("baselineMonth", row.getBaselineMonth());
        result.put("productCount", row.getProductCount());
        result.put("avgUnits", row.getAvgUnits());
        result.put("dislocationScore", row.getDislocationScore());
        result.put("heatSignal", row.getHeatSignal());
        result.put("sellerCounts", buildSellerCounts(row));
        result.put("shares", buildShares(row));
        return result;
    }

    @Override
    public Map<String, Object> listOpportunities(String marketplace, String month, String heatSignal, int limit) {
        String normalizedMarketplace = normalizeRequiredMarketplace(marketplace);
        String normalizedHeatSignal = normalizeHeatSignal(heatSignal);
        String baselineMonth = normalizeMonth(month);
        int safeLimit = limit <= 0 ? 20 : Math.min(limit, 200);

        if (baselineMonth == null) {
            baselineMonth = categoryDislocationMapper.selectLatestBaselineMonth(normalizedMarketplace);
        }

        List<Map<String, Object>> items = new ArrayList<>();
        if (baselineMonth != null) {
            LambdaQueryWrapper<CategoryDislocation> wrapper = new LambdaQueryWrapper<>();
            wrapper.eq(CategoryDislocation::getMarketplace, normalizedMarketplace)
                    .eq(CategoryDislocation::getBaselineMonth, baselineMonth);
            if (!SIGNAL_ALL.equals(normalizedHeatSignal)) {
                wrapper.eq(CategoryDislocation::getHeatSignal, normalizedHeatSignal);
            }
            wrapper.orderByDesc(CategoryDislocation::getDislocationScore)
                    .orderByDesc(CategoryDislocation::getNonCnShare)
                    .orderByDesc(CategoryDislocation::getAvgUnits)
                    .last("LIMIT " + safeLimit);

            for (CategoryDislocation row : categoryDislocationMapper.selectList(wrapper)) {
                items.add(toOpportunityItem(row));
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("marketplace", normalizedMarketplace);
        result.put("baselineMonth", baselineMonth);
        result.put("heatSignal", normalizedHeatSignal);
        result.put("limit", safeLimit);
        result.put("total", items.size());
        result.put("items", items);
        return result;
    }

    @Override
    public Map<String, Object> listActionableOpportunities(String marketplace, String month, String heatSignal, int limit) {
        String normalizedMarketplace = normalizeRequiredMarketplace(marketplace);
        String normalizedHeatSignal = normalizeHeatSignal(heatSignal);
        String baselineMonth = normalizeMonth(month);
        int safeLimit = limit <= 0 ? 20 : Math.min(limit, 200);

        if (baselineMonth == null) {
            baselineMonth = categoryDislocationMapper.selectLatestBaselineMonth(normalizedMarketplace);
        }

        List<Map<String, Object>> items = new ArrayList<>();
        if (baselineMonth != null) {
            List<CategoryDislocation> slices = categoryDislocationMapper.selectActionableSlices(
                    normalizedMarketplace,
                    baselineMonth,
                    normalizedHeatSignal,
                    safeLimit
            );
            List<String> canonicalKeys = slices.stream()
                    .map(CategoryDislocation::getCanonicalKey)
                    .filter(this::hasText)
                    .distinct()
                    .toList();

            Map<String, WinnerTypeSummary> summaryIndex = canonicalKeys.isEmpty()
                    ? Map.of()
                    : buildWinnerSummaryIndex(categoryDislocationMapper.selectWinnerTypeSummaries(canonicalKeys));

            for (CategoryDislocation row : slices) {
                WinnerTypeSummary summary = summaryIndex.get(row.getCanonicalKey());
                if (summary == null) {
                    continue;
                }
                items.add(toActionableOpportunityItem(row, summary));
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("marketplace", normalizedMarketplace);
        result.put("baselineMonth", baselineMonth);
        result.put("heatSignal", normalizedHeatSignal);
        result.put("limit", safeLimit);
        result.put("total", items.size());
        result.put("items", items);
        return result;
    }

    private CategoryDislocation selectHealthRow(String marketplace,
                                                String subCategory,
                                                String canonicalKey,
                                                String baselineMonth) {
        LambdaQueryWrapper<CategoryDislocation> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(CategoryDislocation::getMarketplace, marketplace)
                .and(query -> query
                        .eq(CategoryDislocation::getCanonicalKey, canonicalKey)
                        .or()
                        .eq(CategoryDislocation::getSubCategory, subCategory));

        if (baselineMonth != null) {
            wrapper.eq(CategoryDislocation::getBaselineMonth, baselineMonth);
        } else {
            wrapper.orderByDesc(CategoryDislocation::getBaselineMonth)
                    .orderByDesc(CategoryDislocation::getComputedAt)
                    .last("LIMIT 1");
        }
        return categoryDislocationMapper.selectOne(wrapper);
    }

    private CategoryDislocation selectHealthRowByCanonicalKey(String marketplace,
                                                              String canonicalKey,
                                                              String baselineMonth) {
        LambdaQueryWrapper<CategoryDislocation> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(CategoryDislocation::getMarketplace, marketplace)
                .eq(CategoryDislocation::getCanonicalKey, canonicalKey);

        if (baselineMonth != null) {
            wrapper.eq(CategoryDislocation::getBaselineMonth, baselineMonth);
        } else {
            wrapper.orderByDesc(CategoryDislocation::getBaselineMonth)
                    .orderByDesc(CategoryDislocation::getComputedAt)
                    .last("LIMIT 1");
        }
        return categoryDislocationMapper.selectOne(wrapper);
    }

    private long countRows(String baselineMonth, String marketplace) {
        QueryWrapper<CategoryDislocation> wrapper = new QueryWrapper<>();
        wrapper.eq("baseline_month", baselineMonth);
        if (marketplace != null) {
            wrapper.eq("marketplace", marketplace);
        }
        return categoryDislocationMapper.selectCount(wrapper);
    }

    private Map<String, Object> toOpportunityItem(CategoryDislocation row) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("bsrId", row.getBsrId());
        item.put("canonicalKey", row.getCanonicalKey());
        item.put("subCategory", row.getSubCategory());
        item.put("productCount", row.getProductCount());
        item.put("avgUnits", row.getAvgUnits());
        item.put("dislocationScore", row.getDislocationScore());
        item.put("heatSignal", row.getHeatSignal());
        item.put("sellerCounts", buildSellerCounts(row));
        item.put("shares", buildShares(row));
        return item;
    }

    private Map<String, WinnerTypeSummary> buildWinnerSummaryIndex(List<WinnerTypeSummary> summaries) {
        Map<String, WinnerTypeSummary> index = new LinkedHashMap<>();
        if (summaries == null) {
            return index;
        }
        for (WinnerTypeSummary summary : summaries) {
            if (summary == null || !hasText(summary.getCanonicalKey())) {
                continue;
            }
            index.put(summary.getCanonicalKey(), summary);
        }
        return index;
    }

    private Map<String, Object> toActionableOpportunityItem(CategoryDislocation row, WinnerTypeSummary summary) {
        Map<String, Object> item = toOpportunityItem(row);
        item.put("winnerCanonicalName", summary.getCanonicalName());
        item.put("winnerCount", summary.getWinnerCount());
        item.put("greenCount", summary.getGreenCount());
        item.put("eliminatedCount", summary.getEliminatedCount());
        item.put("winnerMarketplaces", splitSummaryValues(summary.getWinnerMarketplaces(), ","));
        item.put("topArchetypes", splitSummaryValues(summary.getTopArchetypes(), "\\|"));
        item.put("topCarriers", splitSummaryValues(summary.getTopCarriers(), "\\|"));
        item.put("topElements", splitSummaryValues(summary.getTopElements(), "\\|"));
        return item;
    }

    private Map<String, Object> buildSellerCounts(CategoryDislocation row) {
        Map<String, Object> sellerCounts = new LinkedHashMap<>();
        sellerCounts.put("dengzong", row.getDengzongCount());
        sellerCounts.put("otherCn", row.getOtherCnCount());
        sellerCounts.put("nonCn", row.getNonCnCount());
        sellerCounts.put("total", row.getTotalSellers());
        return sellerCounts;
    }

    private Map<String, Object> buildShares(CategoryDislocation row) {
        Map<String, Object> shares = new LinkedHashMap<>();
        shares.put("dzShare", row.getDzShare());
        shares.put("nonCnShare", row.getNonCnShare());
        return shares;
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

    private String normalizeMarketplace(String marketplace) {
        String value = trimToNull(marketplace);
        return value == null ? null : value.toUpperCase(Locale.ROOT);
    }

    private String normalizeRequiredMarketplace(String marketplace) {
        String normalized = normalizeMarketplace(marketplace);
        if (normalized == null) {
            throw new IllegalArgumentException("marketplace 不能为空");
        }
        return normalized;
    }

    private String normalizeHeatSignal(String heatSignal) {
        String normalized = trimToNull(heatSignal);
        if (normalized == null) {
            return SIGNAL_GREEN;
        }
        normalized = normalized.toUpperCase(Locale.ROOT);
        if (!List.of(SIGNAL_GREEN, SIGNAL_YELLOW, SIGNAL_RED, SIGNAL_COLD, SIGNAL_ALL).contains(normalized)) {
            throw new IllegalArgumentException("heatSignal 只支持 GREEN / YELLOW / RED / COLD / ALL");
        }
        return normalized;
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

    private String normalizeCanonicalKey(String value) {
        String normalized = normalizeText(value);
        if (normalized == null) {
            throw new IllegalArgumentException("subCategory 不能为空");
        }
        return normalized.replace(' ', '_');
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

    private String requireText(String value, String message) {
        String normalized = trimToNull(value);
        if (normalized == null) {
            throw new IllegalArgumentException(message);
        }
        return normalized;
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private boolean hasText(String value) {
        return trimToNull(value) != null;
    }

    private List<String> splitSummaryValues(String raw, String delimiterRegex) {
        String normalized = trimToNull(raw);
        if (normalized == null) {
            return List.of();
        }
        List<String> values = new ArrayList<>();
        for (String part : normalized.split(delimiterRegex)) {
            String token = trimToNull(part);
            if (token != null) {
                values.add(token);
            }
        }
        return values;
    }

    private String displayMarketplace(String marketplace) {
        return marketplace == null ? "ALL" : marketplace;
    }
}
