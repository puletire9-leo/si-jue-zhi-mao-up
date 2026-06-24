package com.sjzm.product.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.sjzm.product.dto.SubcategoryAliasResolution;
import com.sjzm.product.entity.CategoryBsrBaseline;
import com.sjzm.product.entity.CompetitorProduct;
import com.sjzm.product.entity.SubcategoryBaseline;
import com.sjzm.product.mapper.CategoryBsrBaselineMapper;
import com.sjzm.product.mapper.CompetitorProductMapper;
import com.sjzm.product.mapper.SubcategoryBaselineMapper;
import com.sjzm.product.service.SalesBaselineService;
import com.sjzm.product.service.SubcategoryAliasService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class SalesBaselineServiceImpl implements SalesBaselineService {

    private final CategoryBsrBaselineMapper categoryBsrBaselineMapper;
    private final SubcategoryBaselineMapper subcategoryBaselineMapper;
    private final CompetitorProductMapper competitorProductMapper;
    private final SubcategoryAliasService subcategoryAliasService;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> computeBsrBaseline(String month, String marketplace) {
        String normalizedMarketplace = normalizeMarketplace(marketplace);
        String baselineMonth = resolveBaselineMonth(month, normalizedMarketplace);
        long eligibleRows = countEligibleBsrRows(baselineMonth, normalizedMarketplace);

        if (eligibleRows == 0) {
            return buildFailureResult("competitor_products 无可计算的 BSR 基线样本",
                    baselineMonth, normalizedMarketplace);
        }

        int deleted = categoryBsrBaselineMapper.deleteByBaselineMonth(baselineMonth, normalizedMarketplace);
        int inserted = categoryBsrBaselineMapper.insertComputedSlices(baselineMonth, normalizedMarketplace);
        long totalRows = countCategoryRows(baselineMonth, normalizedMarketplace);

        log.info("①线 category_bsr_baseline 计算完成: month={}, marketplace={}, eligibleRows={}, deleted={}, inserted={}, totalRows={}",
                baselineMonth, normalizedMarketplace, eligibleRows, deleted, inserted, totalRows);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("success", true);
        result.put("baselineMonth", baselineMonth);
        result.put("marketplace", displayMarketplace(normalizedMarketplace));
        result.put("eligibleCompetitorRows", eligibleRows);
        result.put("deleted", deleted);
        result.put("inserted", inserted);
        result.put("totalRows", totalRows);
        return result;
    }

    @Override
    public Map<String, Object> getBsrHealth(String marketplace, String bsrId, Integer bsr, String month) {
        String normalizedMarketplace = normalizeRequiredMarketplace(marketplace);
        String normalizedBsrId = requireText(bsrId, "bsrId / bsr_id 不能为空");
        String baselineMonth = normalizeMonth(month);
        String bsrBucket = resolveBsrBucket(bsr);

        LambdaQueryWrapper<CategoryBsrBaseline> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(CategoryBsrBaseline::getMarketplace, normalizedMarketplace)
                .eq(CategoryBsrBaseline::getBsrId, normalizedBsrId)
                .eq(CategoryBsrBaseline::getBsrBucket, bsrBucket);

        if (baselineMonth != null) {
            wrapper.eq(CategoryBsrBaseline::getBaselineMonth, baselineMonth);
        } else {
            wrapper.orderByDesc(CategoryBsrBaseline::getBaselineMonth)
                    .orderByDesc(CategoryBsrBaseline::getComputedAt)
                    .last("LIMIT 1");
        }

        CategoryBsrBaseline baseline = categoryBsrBaselineMapper.selectOne(wrapper);
        if (baseline == null) {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("hasBaseline", false);
            result.put("marketplace", normalizedMarketplace);
            result.put("bsrId", normalizedBsrId);
            result.put("bsr", bsr);
            result.put("bsrBucket", bsrBucket);
            result.put("baselineMonth", baselineMonth);
            return result;
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("hasBaseline", true);
        result.put("marketplace", normalizedMarketplace);
        result.put("bsrId", baseline.getBsrId());
        result.put("bsr", bsr);
        result.put("bsrBucket", baseline.getBsrBucket());
        result.put("baselineMonth", baseline.getBaselineMonth());
        result.put("sampleSize", baseline.getSampleSize());
        result.put("confidence", baseline.getConfidence());
        result.put("units", buildBsrBenchmark(
                baseline.getUnitsP25(),
                baseline.getUnitsP50(),
                baseline.getUnitsP75()
        ));
        result.put("priceAvg", baseline.getPriceAvg());
        return result;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> computeSubcategoryBaseline(String month, String marketplace) {
        String normalizedMarketplace = normalizeMarketplace(marketplace);
        String baselineMonth = resolveBaselineMonth(month, normalizedMarketplace);
        Map<String, Object> aliasBootstrap = subcategoryAliasService.bootstrap(baselineMonth, normalizedMarketplace);

        int deleted = subcategoryBaselineMapper.deleteByBaselineMonth(baselineMonth, normalizedMarketplace);
        int inserted = subcategoryBaselineMapper.insertComputedSlices(baselineMonth, normalizedMarketplace);
        long totalRows = countSubcategoryRows(baselineMonth, normalizedMarketplace);

        log.info("①线 subcategory_baseline 计算完成: month={}, marketplace={}, deleted={}, inserted={}, totalRows={}",
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
            result.put("message", "没有命中③线赢家子类的小类基线样本");
        }
        return result;
    }

    @Override
    public Map<String, Object> getSubcategoryHealth(String marketplace, String subCategory, String month) {
        String normalizedMarketplace = normalizeRequiredMarketplace(marketplace);
        String normalizedSubCategory = requireText(subCategory, "subCategory / sub_category 不能为空");
        String baselineMonth = normalizeMonth(month);
        String normalizedCanonicalKey = normalizeCanonicalKey(normalizedSubCategory);

        LambdaQueryWrapper<SubcategoryBaseline> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SubcategoryBaseline::getMarketplace, normalizedMarketplace)
                .and(query -> query
                        .eq(SubcategoryBaseline::getCanonicalKey, normalizedCanonicalKey)
                        .or()
                        .eq(SubcategoryBaseline::getSubCategory, normalizedSubCategory));

        if (baselineMonth != null) {
            wrapper.eq(SubcategoryBaseline::getBaselineMonth, baselineMonth);
        } else {
            wrapper.orderByDesc(SubcategoryBaseline::getBaselineMonth)
                    .orderByDesc(SubcategoryBaseline::getComputedAt)
                    .last("LIMIT 1");
        }

        SubcategoryBaseline baseline = subcategoryBaselineMapper.selectOne(wrapper);
        String resolvedBy = "DIRECT";
        String matchedRawSubcategory = normalizedSubCategory;

        if (baseline == null) {
            SubcategoryAliasResolution resolution = subcategoryAliasService.resolve(normalizedMarketplace, normalizedSubCategory);
            if (resolution != null) {
                resolvedBy = resolution.matchMethod();
                matchedRawSubcategory = resolution.matchedRawSubcategory();

                LambdaQueryWrapper<SubcategoryBaseline> canonicalWrapper = new LambdaQueryWrapper<>();
                canonicalWrapper.eq(SubcategoryBaseline::getMarketplace, normalizedMarketplace)
                        .eq(SubcategoryBaseline::getCanonicalKey, resolution.canonicalKey());

                if (baselineMonth != null) {
                    canonicalWrapper.eq(SubcategoryBaseline::getBaselineMonth, baselineMonth);
                } else {
                    canonicalWrapper.orderByDesc(SubcategoryBaseline::getBaselineMonth)
                            .orderByDesc(SubcategoryBaseline::getComputedAt)
                            .last("LIMIT 1");
                }
                baseline = subcategoryBaselineMapper.selectOne(canonicalWrapper);
            }
        }

        if (baseline == null) {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("hasBaseline", false);
            result.put("marketplace", normalizedMarketplace);
            result.put("subCategory", normalizedSubCategory);
            result.put("baselineMonth", baselineMonth);
            return result;
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("hasBaseline", true);
        result.put("marketplace", normalizedMarketplace);
        result.put("bsrId", baseline.getBsrId());
        result.put("canonicalKey", baseline.getCanonicalKey());
        result.put("subCategory", baseline.getSubCategory());
        result.put("querySubCategory", normalizedSubCategory);
        result.put("matchedRawSubCategory", matchedRawSubcategory);
        result.put("resolvedBy", resolvedBy);
        result.put("baselineMonth", baseline.getBaselineMonth());
        result.put("sampleSize", baseline.getSampleSize());
        result.put("confidence", baseline.getConfidence());
        result.put("units", buildSubcategoryBenchmark(
                baseline.getUnitsP50(),
                baseline.getUnitsP75(),
                baseline.getUnitsP90()
        ));
        result.put("priceP50", baseline.getPriceP50());
        return result;
    }

    private Map<String, Object> buildFailureResult(String message, String baselineMonth, String marketplace) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("success", false);
        result.put("message", message);
        result.put("baselineMonth", baselineMonth);
        result.put("marketplace", displayMarketplace(marketplace));
        return result;
    }

    private long countEligibleBsrRows(String baselineMonth, String marketplace) {
        QueryWrapper<CompetitorProduct> wrapper = new QueryWrapper<>();
        wrapper.eq("month", baselineMonth)
                .isNotNull("bsr_id")
                .ne("bsr_id", "")
                .isNotNull("bsr")
                .isNotNull("units");
        if (marketplace != null) {
            wrapper.eq("marketplace", marketplace);
        }
        return competitorProductMapper.selectCount(wrapper);
    }

    private long countCategoryRows(String baselineMonth, String marketplace) {
        QueryWrapper<CategoryBsrBaseline> wrapper = new QueryWrapper<>();
        wrapper.eq("baseline_month", baselineMonth);
        if (marketplace != null) {
            wrapper.eq("marketplace", marketplace);
        }
        return categoryBsrBaselineMapper.selectCount(wrapper);
    }

    private long countSubcategoryRows(String baselineMonth, String marketplace) {
        QueryWrapper<SubcategoryBaseline> wrapper = new QueryWrapper<>();
        wrapper.eq("baseline_month", baselineMonth);
        if (marketplace != null) {
            wrapper.eq("marketplace", marketplace);
        }
        return subcategoryBaselineMapper.selectCount(wrapper);
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

    private Map<String, Object> buildBsrBenchmark(Object p25, Object p50, Object p75) {
        Map<String, Object> benchmark = new LinkedHashMap<>();
        benchmark.put("p25", p25);
        benchmark.put("p50", p50);
        benchmark.put("p75", p75);
        return benchmark;
    }

    private Map<String, Object> buildSubcategoryBenchmark(Object p50, Object p75, Object p90) {
        Map<String, Object> benchmark = new LinkedHashMap<>();
        benchmark.put("p50", p50);
        benchmark.put("p75", p75);
        benchmark.put("p90", p90);
        return benchmark;
    }

    private String resolveBsrBucket(Integer bsr) {
        if (bsr == null || bsr <= 0) {
            throw new IllegalArgumentException("bsr 必须是正整数");
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

    private String normalizeCanonicalKey(String value) {
        String normalized = normalizeText(value);
        if (normalized == null) {
            throw new IllegalArgumentException("subCategory 不能为空");
        }
        return normalized.replace(' ', '_');
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

    private String displayMarketplace(String marketplace) {
        return marketplace == null ? "ALL" : marketplace;
    }
}
