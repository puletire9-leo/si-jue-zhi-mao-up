package com.sjzm.product.service.impl;

import com.sjzm.common.PageResult;
import com.sjzm.product.dto.MethodCardProductResponse;
import com.sjzm.product.dto.MethodCardQueryRequest;
import com.sjzm.product.mapper.MethodCardMapper;
import com.sjzm.product.methodrule.M01Rule;
import com.sjzm.product.methodrule.M03Rule;
import com.sjzm.product.service.MethodCardService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.temporal.WeekFields;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class MethodCardServiceImpl implements MethodCardService {

    private static final String METHOD_ID_M01 = "M01";
    private static final String METHOD_NAME_M01 = "新品榜加速法";
    private static final String METHOD_ID_M02 = "M02";
    private static final String METHOD_NAME_M02 = "郑总同行品线跟随法";
    private static final String METHOD_ID_M03 = "M03";
    private static final String METHOD_NAME_M03 = "FBM 自发货简单道";

    private final MethodCardMapper methodCardMapper;

    @Override
    public PageResult<MethodCardProductResponse> queryM01Products(MethodCardQueryRequest request) {
        M01Rule rule = M01Rule.forMarketplace(request.getMarketplace());
        int page = Math.max(1, request.getPage() == null ? 1 : request.getPage());
        int size = Math.max(1, Math.min(request.getSize() == null ? 60 : request.getSize(), 100));
        int offset = (page - 1) * size;

        List<String> effectiveWeekTags = resolveEffectiveWeekTags(request, rule.marketplace());
        long total = methodCardMapper.countM01Products(
                rule.marketplace(),
                blankToNull(request.getMonth()),
                effectiveWeekTags,
                blankToNull(request.getBsrId()),
                request.getNodeId(),
                rule.priceMin(),
                rule.priceMax(),
                rule.weightMax(),
                rule.listingDaysMax(),
                rule.sales30(),
                rule.sales60(),
                rule.sales90(),
                rule.bsrMax()
        );
        if (total == 0) {
            return PageResult.empty((long) page, (long) size);
        }

        List<MethodCardProductResponse> list = methodCardMapper.selectM01Products(
                rule.marketplace(),
                blankToNull(request.getMonth()),
                effectiveWeekTags,
                blankToNull(request.getBsrId()),
                request.getNodeId(),
                rule.priceMin(),
                rule.priceMax(),
                rule.weightMax(),
                rule.listingDaysMax(),
                rule.sales30(),
                rule.sales60(),
                rule.sales90(),
                rule.bsrMax(),
                offset,
                size
        );

        Map<String, Object> snapshot = ruleSnapshot(rule, effectiveWeekTags);
        for (MethodCardProductResponse item : list) {
            item.setMethodId(METHOD_ID_M01);
            item.setMethodName(METHOD_NAME_M01);
            item.setHitReasons(hitReasons(item, rule));
            item.setRuleSnapshot(snapshot);
        }
        return PageResult.of(list, total, (long) page, (long) size);
    }

    @Override
    public PageResult<MethodCardProductResponse> queryM02Products(MethodCardQueryRequest request) {
        String marketplace = normalizeMarketplace(request.getMarketplace());
        int page = Math.max(1, request.getPage() == null ? 1 : request.getPage());
        int size = Math.max(1, Math.min(request.getSize() == null ? 60 : request.getSize(), 100));
        int offset = (page - 1) * size;
        String batchDate = StringUtils.hasText(request.getBatchDate())
                ? request.getBatchDate().trim()
                : methodCardMapper.selectLatestM02BatchDate(marketplace);

        if (!StringUtils.hasText(batchDate)) {
            return PageResult.empty((long) page, (long) size);
        }

        long total = methodCardMapper.countM02Products(
                marketplace,
                blankToNull(request.getMonth()),
                batchDate,
                blankToNull(request.getBsrId()),
                request.getNodeId()
        );
        if (total == 0) {
            return PageResult.empty((long) page, (long) size);
        }

        List<MethodCardProductResponse> list = methodCardMapper.selectM02Products(
                marketplace,
                blankToNull(request.getMonth()),
                batchDate,
                blankToNull(request.getBsrId()),
                request.getNodeId(),
                offset,
                size
        );

        Map<String, Object> snapshot = m02RuleSnapshot(marketplace, request, batchDate);
        for (MethodCardProductResponse item : list) {
            item.setMethodId(METHOD_ID_M02);
            item.setMethodName(METHOD_NAME_M02);
            item.setHitReasons(m02HitReasons(item));
            item.setRuleSnapshot(snapshot);
        }
        return PageResult.of(list, total, (long) page, (long) size);
    }

    // ─── M03 FBM 自发货简单道 ─────────────────────────────────────
    // sibling to queryM01Products. 不共用任何路径, 独立 Rule + SQL + 命中原因 + snapshot.
    @Override
    public PageResult<MethodCardProductResponse> queryM03Products(MethodCardQueryRequest request) {
        M03Rule rule = M03Rule.forMarketplace(request.getMarketplace());
        int page = Math.max(1, request.getPage() == null ? 1 : request.getPage());
        int size = Math.max(1, Math.min(request.getSize() == null ? 60 : request.getSize(), 100));
        int offset = (page - 1) * size;

        String effectiveWeekTag = resolveM03EffectiveWeekTag(request, rule.marketplace());
        long total = methodCardMapper.countM03Products(
                rule.marketplace(),
                blankToNull(request.getMonth()),
                effectiveWeekTag,
                rule.listingDaysMax(),
                rule.sales90()
        );
        if (total == 0) {
            return PageResult.empty((long) page, (long) size);
        }

        List<MethodCardProductResponse> list = methodCardMapper.selectM03Products(
                rule.marketplace(),
                blankToNull(request.getMonth()),
                effectiveWeekTag,
                rule.listingDaysMax(),
                rule.sales90(),
                offset,
                size
        );

        Map<String, Object> snapshot = m03RuleSnapshot(rule, effectiveWeekTag);
        for (MethodCardProductResponse item : list) {
            item.setMethodId(METHOD_ID_M03);
            item.setMethodName(METHOD_NAME_M03);
            item.setHitReasons(m03HitReasons(item, rule));
            item.setRuleSnapshot(snapshot);
        }
        return PageResult.of(list, total, (long) page, (long) size);
    }

    private String resolveM03EffectiveWeekTag(MethodCardQueryRequest request, String marketplace) {
        if (StringUtils.hasText(request.getCreatedWeek())) {
            return request.getCreatedWeek().trim();
        }
        if (StringUtils.hasText(request.getMonth())) {
            return null;
        }
        return methodCardMapper.selectLatestM03EffectiveWeek(marketplace);
    }

    private static List<String> m03HitReasons(MethodCardProductResponse item, M03Rule rule) {
        List<String> reasons = new ArrayList<>();
        reasons.add("FBM_FULFILLMENT");
        if (item.getListingDays() != null && item.getListingDays() < rule.listingDaysMax()) {
            reasons.add("LISTING_UNDER_90D");
        }
        if (item.getUnits() != null && item.getUnits() >= rule.sales90()) {
            reasons.add("SALES_90D_PASS");
        }
        return reasons;
    }

    private static Map<String, Object> m03RuleSnapshot(M03Rule rule, String effectiveWeekTag) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("methodId", METHOD_ID_M03);
        snapshot.put("methodName", METHOD_NAME_M03);
        snapshot.put("marketplace", rule.marketplace());
        snapshot.put("listingDaysMax", rule.listingDaysMax());
        snapshot.put("sales90", rule.sales90());
        snapshot.put("fulfillment", "FBM");
        snapshot.put("effectiveWeekTag", effectiveWeekTag);
        return snapshot;
    }

    List<String> resolveEffectiveWeekTags(MethodCardQueryRequest request, String marketplace) {
        List<String> requestedWeeks = normalizeCreatedWeeks(request.getCreatedWeeks());
        if (!requestedWeeks.isEmpty()) return requestedWeeks;
        if (StringUtils.hasText(request.getCreatedWeek())) {
            return List.of(normalizeCreatedWeekValue(request.getCreatedWeek()));
        }
        if (StringUtils.hasText(request.getMonth())) {
            return List.of();
        }
        String latestWeek = methodCardMapper.selectLatestM01EffectiveWeek(marketplace);
        return StringUtils.hasText(latestWeek) ? List.of(latestWeek.trim()) : List.of();
    }

    private static List<String> normalizeCreatedWeeks(Collection<String> rawWeeks) {
        if (rawWeeks == null || rawWeeks.isEmpty()) return List.of();
        LinkedHashSet<String> normalized = new LinkedHashSet<>();
        for (String rawWeek : rawWeeks) {
            if (StringUtils.hasText(rawWeek)) {
                normalized.add(normalizeCreatedWeekValue(rawWeek));
            }
        }
        return List.copyOf(normalized);
    }

    /** 兼容旧前端/旧预设保存的 yyyyMMdd 或 yyyy-MM-dd，统一转为 ISO 周标签。 */
    static String normalizeCreatedWeekValue(String rawValue) {
        String value = rawValue.trim();
        LocalDate date = null;
        try {
            if (value.matches("\\d{8}")) {
                date = LocalDate.parse(value, DateTimeFormatter.BASIC_ISO_DATE);
            } else if (value.matches("\\d{4}-\\d{2}-\\d{2}")) {
                date = LocalDate.parse(value, DateTimeFormatter.ISO_LOCAL_DATE);
            }
        } catch (DateTimeParseException ignored) {
            // 非法旧日期保持原值，让查询安全地返回空结果，而不是退回全量。
        }
        if (date == null) return value.toUpperCase(Locale.ROOT);
        WeekFields iso = WeekFields.ISO;
        return String.format(
                Locale.ROOT,
                "%04d-W%02d",
                date.get(iso.weekBasedYear()),
                date.get(iso.weekOfWeekBasedYear())
        );
    }

    private static List<String> hitReasons(MethodCardProductResponse item, M01Rule rule) {
        List<String> reasons = new ArrayList<>();
        Integer listingDays = item.getListingDays();
        Integer units = item.getUnits();
        Integer bsr = item.getBsr();
        if (listingDays != null && units != null) {
            if (listingDays <= 30 && units >= rule.sales30()) reasons.add("SALES_30D_PASS");
            if (listingDays <= 60 && units >= rule.sales60()) reasons.add("SALES_60D_PASS");
            if (listingDays <= 90 && units >= rule.sales90()) reasons.add("SALES_90D_PASS");
        }
        // BSR 阈值可为空 (如 US 站点 M01 文档中标注 BSR 阈值 —,即不使用 BSR 判定)
        if (rule.bsrMax() != null && bsr != null && bsr > 0 && bsr < rule.bsrMax()) {
            reasons.add("BSR_PASS");
        }
        return reasons;
    }

    private static Map<String, Object> ruleSnapshot(M01Rule rule, List<String> effectiveWeekTags) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("methodId", METHOD_ID_M01);
        snapshot.put("methodName", METHOD_NAME_M01);
        snapshot.put("marketplace", rule.marketplace());
        snapshot.put("priceMin", rule.priceMin());
        snapshot.put("priceMax", rule.priceMax());
        snapshot.put("weightMax", rule.weightMax());
        snapshot.put("listingDaysMax", rule.listingDaysMax());
        snapshot.put("sales30", rule.sales30());
        snapshot.put("sales60", rule.sales60());
        snapshot.put("sales90", rule.sales90());
        snapshot.put("bsrMax", rule.bsrMax());
        snapshot.put("effectiveWeekTags", effectiveWeekTags);
        snapshot.put("effectiveWeekTag", effectiveWeekTags.size() == 1 ? effectiveWeekTags.get(0) : null);
        return snapshot;
    }

    private static Map<String, Object> m02RuleSnapshot(
            String marketplace,
            MethodCardQueryRequest request,
            String batchDate) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("methodId", METHOD_ID_M02);
        snapshot.put("methodName", METHOD_NAME_M02);
        snapshot.put("marketplace", marketplace);
        snapshot.put("month", blankToNull(request.getMonth()));
        snapshot.put("batchDate", batchDate);
        snapshot.put("bsrId", blankToNull(request.getBsrId()));
        snapshot.put("nodeId", request.getNodeId());
        snapshot.put("sourceTable", "deng_zong_shop");
        return snapshot;
    }

    private static List<String> m02HitReasons(MethodCardProductResponse item) {
        List<String> reasons = new ArrayList<>();
        reasons.add("ZHENG_PEER_BATCH_MATCH");
        if (item.getUnits() != null && item.getUnits() > 0) {
            reasons.add("PEER_SALES_VISIBLE");
        }
        if (item.getBsr() != null && item.getBsr() > 0) {
            reasons.add("PEER_BSR_VISIBLE");
        }
        if ("FBA".equalsIgnoreCase(item.getFulfillment())) {
            reasons.add("PEER_FBA");
        }
        if (item.getRating() != null && item.getRating().compareTo(new BigDecimal("4.0")) >= 0) {
            reasons.add("PEER_RATING_4_PLUS");
        }
        return reasons;
    }

    private static String normalizeMarketplace(String marketplace) {
        return StringUtils.hasText(marketplace)
                ? marketplace.trim().toUpperCase(Locale.ROOT)
                : "UK";
    }

    private static String blankToNull(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }
}
