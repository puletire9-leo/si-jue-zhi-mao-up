package com.sjzm.product.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.sjzm.product.entity.CategoryBsrBaseline;
import com.sjzm.product.entity.CompetitorProduct;
import com.sjzm.product.entity.SubcategoryBaseline;
import com.sjzm.product.mapper.CategoryBsrBaselineMapper;
import com.sjzm.product.mapper.CompetitorProductMapper;
import com.sjzm.product.mapper.SubcategoryBaselineMapper;
import com.sjzm.product.service.SalesBaselineService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
        long eligibleRows = countEligibleSubcategoryRows(baselineMonth, normalizedMarketplace);

        if (eligibleRows == 0) {
            return buildFailureResult("competitor_products 无可计算的亚马逊小类基线样本",
                    baselineMonth, normalizedMarketplace);
        }

        int deleted = subcategoryBaselineMapper.deleteByBaselineMonth(baselineMonth, normalizedMarketplace);
        int inserted = subcategoryBaselineMapper.insertComputedSlices(baselineMonth, normalizedMarketplace);
        long totalRows = countSubcategoryRows(baselineMonth, normalizedMarketplace);

        log.info("①线 subcategory_baseline 计算完成: month={}, marketplace={}, deleted={}, inserted={}, totalRows={}",
                baselineMonth, normalizedMarketplace, deleted, inserted, totalRows);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("success", inserted > 0);
        result.put("baselineMonth", baselineMonth);
        result.put("marketplace", displayMarketplace(normalizedMarketplace));
        result.put("minimumSampleSize", 30);
        result.put("eligibleCompetitorRows", eligibleRows);
        result.put("deleted", deleted);
        result.put("inserted", inserted);
        result.put("totalRows", totalRows);
        if (inserted == 0) {
            result.put("message", "没有满足样本>=30的亚马逊小类基线样本");
        }
        return result;
    }

    @Override
    public Map<String, Object> getSubcategoryHealth(String marketplace, String bsrId, String subCategory, String month) {
        String normalizedMarketplace = normalizeRequiredMarketplace(marketplace);
        String normalizedBsrId = requireText(bsrId, "bsrId / bsr_id 不能为空");
        String normalizedSubCategory = requireText(subCategory, "subCategory / sub_category 不能为空");
        String baselineMonth = normalizeMonth(month);

        LambdaQueryWrapper<SubcategoryBaseline> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SubcategoryBaseline::getMarketplace, normalizedMarketplace)
                .eq(SubcategoryBaseline::getBsrId, normalizedBsrId)
                .eq(SubcategoryBaseline::getSubCategory, normalizedSubCategory);

        if (baselineMonth != null) {
            wrapper.eq(SubcategoryBaseline::getBaselineMonth, baselineMonth);
        } else {
            wrapper.orderByDesc(SubcategoryBaseline::getBaselineMonth)
                    .orderByDesc(SubcategoryBaseline::getComputedAt)
                    .last("LIMIT 1");
        }

        SubcategoryBaseline baseline = subcategoryBaselineMapper.selectOne(wrapper);

        if (baseline == null) {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("hasBaseline", false);
            result.put("marketplace", normalizedMarketplace);
            result.put("bsrId", normalizedBsrId);
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
        result.put("queryBsrId", normalizedBsrId);
        result.put("querySubCategory", normalizedSubCategory);
        result.put("matchedRawSubCategory", baseline.getSubCategory());
        result.put("resolvedBy", "AMAZON_LEAF");
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

    private long countEligibleSubcategoryRows(String baselineMonth, String marketplace) {
        QueryWrapper<CompetitorProduct> wrapper = new QueryWrapper<>();
        wrapper.eq("month", baselineMonth)
                .isNotNull("bsr_id")
                .ne("bsr_id", "")
                .isNotNull("node_label_path")
                .apply("TRIM(SUBSTRING_INDEX(node_label_path, ':', -1)) != ''")
                .apply("LOWER(TRIM(SUBSTRING_INDEX(node_label_path, ':', -1))) != 'null'")
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
