package com.sjzm.product.modules.lingxing.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sjzm.product.mapper.LingxingLocalProductMapper;
import com.sjzm.product.mapper.LingxingProductPerformanceMapper;
import com.sjzm.product.mapper.LingxingProfitAsinMapper;
import com.sjzm.product.mapper.LingxingPurchaseDataLayerMapper;
import com.sjzm.product.modules.lingxing.entity.LingxingLocalProduct;
import com.sjzm.product.modules.lingxing.entity.LingxingProductPerformance;
import com.sjzm.product.modules.lingxing.entity.LingxingProfitAsin;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 精铺测品模型分析。
 *
 * 第一版只基于已落库的领星数据做 cohort 级复盘和模型参数试算：
 * - lingxing_local_product: SKU 池、创建月份、标签、采购成本
 * - lingxing_product_performance: 时间窗销量/销售额/毛利/广告
 * - lingxing_profit_asin: 逐日利润数据（可选数据源）
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LingxingSamplingModelService {

    private static final String DEFAULT_TARGET_TAG = "欧洲精铺2025";
    private static final String DEFAULT_PENDING_TAG = "待淘汰";
    private static final String DEFAULT_ELIMINATED_TAG = "淘汰";

    private final LingxingLocalProductMapper localProductMapper;
    private final LingxingProductPerformanceMapper performanceMapper;
    private final LingxingProfitAsinMapper profitAsinMapper;
    private final LingxingPurchaseDataLayerMapper purchaseDataLayerMapper;

    public Map<String, Object> analyze(Map<String, Object> req) {
        Map<String, Object> body = req == null ? Map.of() : req;
        LocalDate endDate = readDate(body, "endDate", LocalDate.now());
        LocalDate startDate = readDate(body, "startDate", endDate.minusDays(89));
        if (endDate.isBefore(startDate)) {
            throw new IllegalArgumentException("endDate 不能早于 startDate");
        }

        String source = readString(body, "source", "performance").toLowerCase(Locale.ROOT);
        String cohortMonth = readString(body, "cohortMonth", null);
        String targetTag = readString(body, "targetTag", DEFAULT_TARGET_TAG);
        String pendingTag = readString(body, "pendingEliminationTag", DEFAULT_PENDING_TAG);
        String eliminatedTag = readString(body, "eliminatedTag", DEFAULT_ELIMINATED_TAG);
        int hitUnitsThreshold = readInt(body, "hitUnitsThreshold", 1);

        BigDecimal q1 = readDecimal(body, "q1", null);
        BigDecimal q2 = readDecimal(body, "q2", null);
        BigDecimal l1 = readDecimal(body, "firstBatchLoss", null);
        BigDecimal l2 = readDecimal(body, "secondBatchLoss", null);
        BigDecimal fixedCost = readDecimal(body, "fixedCost", BigDecimal.ZERO);

        int defaultTurnoverThreshold = q1 != null && q2 != null
                ? q1.add(q2).setScale(0, RoundingMode.CEILING).intValue()
                : 30;
        int turnoverUnitsThreshold = readInt(body, "turnoverUnitsThreshold", defaultTurnoverThreshold);

        List<LingxingLocalProduct> localProducts = loadLocalProducts(cohortMonth, targetTag);
        Map<String, LingxingLocalProduct> localBySku = localProducts.stream()
                .filter(p -> StringUtils.hasText(p.getSku()))
                .collect(Collectors.toMap(LingxingLocalProduct::getSku, Function.identity(), (a, b) -> a));
        boolean restrictToLocalCohort = StringUtils.hasText(cohortMonth) && !localBySku.isEmpty();

        Map<String, SkuAggregate> aggregates = "profit".equals(source)
                ? aggregateProfitRows(startDate, endDate, localBySku, restrictToLocalCohort, targetTag, pendingTag, eliminatedTag)
                : aggregatePerformanceRows(startDate, endDate, localBySku, restrictToLocalCohort, targetTag, pendingTag, eliminatedTag);

        for (LingxingLocalProduct product : localProducts) {
            String sku = product.getSku();
            if (!StringUtils.hasText(sku)) continue;
            aggregates.computeIfAbsent(sku, key -> SkuAggregate.fromLocalProduct(product, pendingTag, eliminatedTag));
        }

        List<SkuAggregate> rows = aggregates.values().stream()
                .filter(row -> belongsToTarget(row, localBySku, targetTag))
                .sorted(Comparator.comparing(SkuAggregate::getVolume).reversed()
                        .thenComparing(SkuAggregate::getSku, Comparator.nullsLast(String::compareTo)))
                .toList();

        int skuCount = rows.size();
        int hitSkuCount = (int) rows.stream().filter(row -> row.volume >= hitUnitsThreshold).count();
        int turnedSkuCount = (int) rows.stream()
                .filter(row -> row.volume >= turnoverUnitsThreshold && !row.eliminated && !row.pendingElimination)
                .count();
        int eliminatedSkuCount = (int) rows.stream().filter(row -> row.eliminated).count();
        int pendingEliminationSkuCount = (int) rows.stream().filter(row -> row.pendingElimination).count();
        int zeroSalesSkuCount = (int) rows.stream().filter(row -> row.volume <= 0).count();

        int totalVolume = rows.stream().mapToInt(SkuAggregate::getVolume).sum();
        BigDecimal totalAmount = rows.stream().map(SkuAggregate::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal grossProfit = rows.stream().map(SkuAggregate::getGrossProfit).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal adSpend = rows.stream().map(SkuAggregate::getAdSpend).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal avgContributionProfit = totalVolume > 0
                ? grossProfit.divide(BigDecimal.valueOf(totalVolume), 6, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;
        BigDecimal unitMargin = readDecimal(body, "unitMargin", null);
        BigDecimal effectiveUnitMargin = unitMargin != null ? unitMargin : avgContributionProfit;

        BigDecimal r1 = ratio(hitSkuCount, skuCount);
        BigDecimal r2 = ratio(turnedSkuCount, hitSkuCount);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("window", mapOf(
                "startDate", startDate.toString(),
                "endDate", endDate.toString(),
                "source", source,
                "cohortMonth", cohortMonth,
                "targetTag", targetTag));
        result.put("thresholds", mapOf(
                "hitUnitsThreshold", hitUnitsThreshold,
                "turnoverUnitsThreshold", turnoverUnitsThreshold,
                "pendingEliminationTag", pendingTag,
                "eliminatedTag", eliminatedTag));
        result.put("cohort", mapOf(
                "skuCount", skuCount,
                "hitSkuCount", hitSkuCount,
                "turnedSkuCount", turnedSkuCount,
                "zeroSalesSkuCount", zeroSalesSkuCount,
                "pendingEliminationSkuCount", pendingEliminationSkuCount,
                "eliminatedSkuCount", eliminatedSkuCount,
                "r1", pct(r1),
                "r2", pct(r2)));
        result.put("actuals", mapOf(
                "totalVolume", totalVolume,
                "totalAmount", money(totalAmount),
                "grossProfit", money(grossProfit),
                "adSpend", money(adSpend),
                "avgContributionProfit", money(avgContributionProfit)));
        result.put("model", buildModel(skuCount, r1, r2, q1, q2, effectiveUnitMargin, l1, l2, fixedCost));
        result.put("topSkus", rows.stream().limit(30).map(SkuAggregate::toMap).toList());
        result.put("dataGaps", dataGaps(q1, q2, unitMargin, l1, l2, localProducts.size(), source));

        log.info("精铺测品模型分析完成: source={}, window={}~{}, skuCount={}, hit={}, turned={}, r1={}, r2={}",
                source, startDate, endDate, skuCount, hitSkuCount, turnedSkuCount, pct(r1), pct(r2));
        return result;
    }

    /**
     * First-pass batch analysis. Purchase rows define Q1/Q2; weekly rows only
     * provide an approximate lifecycle because actual FBA arrival dates are not
     * available in the current data layer.
     */
    public Map<String, Object> analyzeBatch(Map<String, Object> req) {
        Map<String, Object> body = req == null ? Map.of() : req;
        LocalDate endDate = readDate(body, "endDate", LocalDate.now());
        LocalDate startDate = readDate(body, "startDate", endDate.minusDays(180));
        if (endDate.isBefore(startDate)) {
            throw new IllegalArgumentException("endDate 不能早于 startDate");
        }

        String snapshotWeek = readString(body, "snapshotWeek", null);
        BigDecimal scenarioQ1 = readDecimal(body, "q1", null);
        BigDecimal scenarioQ2 = readDecimal(body, "q2", null);
        int thresholdDefault = scenarioQ1 != null && scenarioQ2 != null
                ? scenarioQ1.add(scenarioQ2).setScale(0, RoundingMode.CEILING).intValue()
                : 30;
        int turnoverThreshold = readInt(body, "turnoverUnitsThreshold", thresholdDefault);
        int minObservationWeeks = readInt(body, "minObservationWeeks", 4);
        BigDecimal unitMargin = readDecimal(body, "unitMargin", null);
        BigDecimal firstBatchLoss = readDecimal(body, "firstBatchLoss", null);
        BigDecimal secondBatchLoss = readDecimal(body, "secondBatchLoss", null);
        BigDecimal fixedCost = readDecimal(body, "fixedCost", BigDecimal.ZERO);

        List<LingxingBatchModelCalculator.PurchaseFact> purchases = purchaseDataLayerMapper
                .selectCompletedPurchaseFacts(startDate.toString(), endDate.toString(), snapshotWeek)
                .stream().map(this::toPurchaseFact).toList();
        List<LingxingBatchModelCalculator.WeeklyFact> weeklyFacts = purchaseDataLayerMapper
                .selectWeeklyFacts(startDate.toString(), endDate.toString())
                .stream().map(this::toWeeklyFact).toList();
        Long targetSkuCount = purchaseDataLayerMapper.countActiveTargetSkus(snapshotWeek);

        LingxingBatchModelCalculator.Parameters parameters = new LingxingBatchModelCalculator.Parameters(
                turnoverThreshold, minObservationWeeks, scenarioQ1, scenarioQ2, unitMargin,
                firstBatchLoss, secondBatchLoss, fixedCost);
        Map<String, Object> result = new LinkedHashMap<>(
                new LingxingBatchModelCalculator().calculate(purchases, weeklyFacts,
                        targetSkuCount == null ? 0 : targetSkuCount, parameters));
        result.put("window", mapOf(
                "startDate", startDate.toString(),
                "endDate", endDate.toString(),
                "snapshotWeek", snapshotWeek,
                "purchaseSource", "completed purchase orders: status=9 and status_shipped=3",
                "performanceSource", "lingxing_sku_weekly_performance"));
        result.put("limitations", List.of(
                "采购子项 sid 缺失时按 SKU 汇总，不能证明店铺级归属。",
                "Q2 后表现按采购下单日切分，实际 FBA 入仓日尚未接入。",
                "未传淘汰损失时不输出净利润，避免把采购成本冒充清仓损失。"));

        int detailLimit = readInt(body, "detailLimit", 200);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> rows = (List<Map<String, Object>>) result.get("rows");
        int totalRows = rows.size();
        int safeLimit = Math.max(0, Math.min(detailLimit, totalRows));
        result.put("rowsTotal", totalRows);
        result.put("rowsReturned", safeLimit);
        result.put("rows", new ArrayList<>(rows.subList(0, safeLimit)));
        return result;
    }

    private LingxingBatchModelCalculator.PurchaseFact toPurchaseFact(Map<String, Object> row) {
        return new LingxingBatchModelCalculator.PurchaseFact(
                text(row.get("sku")), text(row.get("orderSn")), longValue(row.get("itemId")),
                dateTime(row.get("orderTime")), longValue(row.get("sid")), longValue(row.get("wid")),
                integerValue(row.get("quantityReal")), integerValue(row.get("quantityEntry")),
                integerValue(row.get("quantityReceive")), integerValue(row.get("status")),
                integerValue(row.get("statusShipped")));
    }

    private LingxingBatchModelCalculator.WeeklyFact toWeeklyFact(Map<String, Object> row) {
        return new LingxingBatchModelCalculator.WeeklyFact(
                text(row.get("sku")), dateValue(row.get("weekStart")), dateValue(row.get("weekEnd")),
                integerValue(row.get("volume")), decimalValue(row.get("grossProfit")),
                integerValue(row.get("afnFulfillableQuantity")), text(row.get("tags")),
                longValue(row.get("sid")), text(row.get("marketplace")));
    }

    private String text(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private Long longValue(Object value) {
        if (value == null) return null;
        if (value instanceof Number number) return number.longValue();
        try {
            return Long.valueOf(String.valueOf(value));
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private Integer integerValue(Object value) {
        Long number = longValue(value);
        return number == null ? null : number.intValue();
    }

    private BigDecimal decimalValue(Object value) {
        if (value == null) return null;
        if (value instanceof BigDecimal decimal) return decimal;
        if (value instanceof Number number) return BigDecimal.valueOf(number.doubleValue());
        try {
            return new BigDecimal(String.valueOf(value));
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private LocalDate dateValue(Object value) {
        if (value == null) return null;
        if (value instanceof LocalDate date) return date;
        if (value instanceof java.sql.Date date) return date.toLocalDate();
        return LocalDate.parse(String.valueOf(value));
    }

    private java.time.LocalDateTime dateTime(Object value) {
        if (value == null) return null;
        if (value instanceof java.time.LocalDateTime dateTime) return dateTime;
        if (value instanceof java.sql.Timestamp timestamp) return timestamp.toLocalDateTime();
        String text = String.valueOf(value).replace(' ', 'T');
        return java.time.LocalDateTime.parse(text);
    }

    private List<LingxingLocalProduct> loadLocalProducts(String cohortMonth, String targetTag) {
        LambdaQueryWrapper<LingxingLocalProduct> qw = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(cohortMonth)) {
            YearMonth ym = YearMonth.parse(cohortMonth);
            qw.ge(LingxingLocalProduct::getLxCreateTime, ym.atDay(1).atStartOfDay())
                    .lt(LingxingLocalProduct::getLxCreateTime, ym.plusMonths(1).atDay(1).atStartOfDay());
        }
        if (StringUtils.hasText(targetTag)) {
            qw.like(LingxingLocalProduct::getRawJson, targetTag);
        }
        return localProductMapper.selectList(qw);
    }

    private Map<String, SkuAggregate> aggregatePerformanceRows(LocalDate startDate, LocalDate endDate,
                                                               Map<String, LingxingLocalProduct> localBySku,
                                                               boolean restrictToLocalCohort,
                                                               String targetTag, String pendingTag,
                                                               String eliminatedTag) {
        LambdaQueryWrapper<LingxingProductPerformance> qw = new LambdaQueryWrapper<LingxingProductPerformance>()
                .ge(LingxingProductPerformance::getStartDate, startDate)
                .le(LingxingProductPerformance::getEndDate, endDate)
                .eq(LingxingProductPerformance::getSummaryField, "asin");
        List<LingxingProductPerformance> rows = performanceMapper.selectList(qw);
        Map<String, SkuAggregate> aggregates = new LinkedHashMap<>();
        for (LingxingProductPerformance row : rows) {
            String key = firstText(row.getSku(), row.getAsin(), row.getSummaryValue());
            if (!StringUtils.hasText(key)) continue;
            LingxingLocalProduct local = localBySku.get(row.getSku());
            if (restrictToLocalCohort && local == null) continue;
            SkuAggregate agg = aggregates.computeIfAbsent(key,
                    k -> SkuAggregate.fromPerformance(row, local, pendingTag, eliminatedTag));
            agg.add(row);
            if (local != null) agg.mergeLocal(local, pendingTag, eliminatedTag);
            agg.mergeRaw(row.getRawJson(), pendingTag, eliminatedTag);
            if (StringUtils.hasText(targetTag) && contains(row.getRawJson(), targetTag)) {
                agg.targetTagged = true;
            }
        }
        return aggregates;
    }

    private Map<String, SkuAggregate> aggregateProfitRows(LocalDate startDate, LocalDate endDate,
                                                          Map<String, LingxingLocalProduct> localBySku,
                                                          boolean restrictToLocalCohort,
                                                          String targetTag, String pendingTag,
                                                          String eliminatedTag) {
        LambdaQueryWrapper<LingxingProfitAsin> qw = new LambdaQueryWrapper<LingxingProfitAsin>()
                .ge(LingxingProfitAsin::getDataDate, startDate)
                .le(LingxingProfitAsin::getDataDate, endDate);
        List<LingxingProfitAsin> rows = profitAsinMapper.selectList(qw);
        Map<String, SkuAggregate> aggregates = new LinkedHashMap<>();
        for (LingxingProfitAsin row : rows) {
            String key = firstText(row.getLocalSku(), row.getAsin());
            if (!StringUtils.hasText(key)) continue;
            LingxingLocalProduct local = localBySku.get(row.getLocalSku());
            if (restrictToLocalCohort && local == null) continue;
            SkuAggregate agg = aggregates.computeIfAbsent(key,
                    k -> SkuAggregate.fromProfit(row, local, pendingTag, eliminatedTag));
            agg.add(row);
            if (local != null) agg.mergeLocal(local, pendingTag, eliminatedTag);
            agg.mergeRaw(row.getRawJson(), pendingTag, eliminatedTag);
            if (StringUtils.hasText(targetTag) && contains(row.getRawJson(), targetTag)) {
                agg.targetTagged = true;
            }
        }
        return aggregates;
    }

    private boolean belongsToTarget(SkuAggregate row, Map<String, LingxingLocalProduct> localBySku, String targetTag) {
        if (!StringUtils.hasText(targetTag)) return true;
        if (row.targetTagged || contains(row.rawText, targetTag)) return true;
        LingxingLocalProduct local = localBySku.get(row.sku);
        return local != null && contains(local.getRawJson(), targetTag);
    }

    private Map<String, Object> buildModel(int n, BigDecimal r1, BigDecimal r2,
                                           BigDecimal q1, BigDecimal q2, BigDecimal m,
                                           BigDecimal l1, BigDecimal l2, BigDecimal fixedCost) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("inputs", mapOf(
                "n", n,
                "q1", q1,
                "q2", q2,
                "unitMargin", money(m),
                "firstBatchLoss", l1,
                "secondBatchLoss", l2,
                "fixedCost", fixedCost));

        boolean complete = n > 0 && q1 != null && q2 != null && m != null
                && l1 != null && l2 != null && fixedCost != null;
        out.put("complete", complete);
        if (!complete) {
            out.put("message", "已输出 R1/R2 和实际毛利；补齐 q1/q2/unitMargin/firstBatchLoss/secondBatchLoss/fixedCost 后可计算盈亏平衡。");
            return out;
        }

        BigDecimal nBd = BigDecimal.valueOf(n);
        BigDecimal one = BigDecimal.ONE;
        BigDecimal q1PlusQ2 = q1.add(q2);

        BigDecimal netProfit = nBd.multiply(r1).multiply(r2).multiply(q1PlusQ2).multiply(m)
                .subtract(nBd.multiply(one.subtract(r1)).multiply(q1).multiply(l1))
                .subtract(nBd.multiply(r1).multiply(one.subtract(r2)).multiply(q2).multiply(l2))
                .subtract(fixedCost);

        BigDecimal simplifiedMinR1 = divide(
                q1.multiply(l1).add(fixedCost.divide(nBd, 8, RoundingMode.HALF_UP)),
                q1PlusQ2.multiply(m).add(q1.multiply(l1)));
        BigDecimal requiredR2 = requiredR2(nBd, r1, q1, q2, m, l1, l2, fixedCost);
        BigDecimal requiredR1AtCurrentR2 = requiredR1(nBd, r2, q1, q2, m, l1, l2, fixedCost);

        out.put("netProfit", money(netProfit));
        out.put("breakEven", netProfit.compareTo(BigDecimal.ZERO) >= 0);
        out.put("simplifiedMinimumR1", pct(simplifiedMinR1));
        out.put("requiredR2AtCurrentR1", pct(requiredR2));
        out.put("requiredR1AtCurrentR2", pct(requiredR1AtCurrentR2));
        return out;
    }

    private BigDecimal requiredR2(BigDecimal n, BigDecimal r1, BigDecimal q1, BigDecimal q2,
                                  BigDecimal m, BigDecimal l1, BigDecimal l2, BigDecimal fixedCost) {
        BigDecimal numerator = n.multiply(BigDecimal.ONE.subtract(r1)).multiply(q1).multiply(l1)
                .add(n.multiply(r1).multiply(q2).multiply(l2))
                .add(fixedCost);
        BigDecimal denominator = n.multiply(r1).multiply(q1.add(q2).multiply(m).add(q2.multiply(l2)));
        return divide(numerator, denominator);
    }

    private BigDecimal requiredR1(BigDecimal n, BigDecimal r2, BigDecimal q1, BigDecimal q2,
                                  BigDecimal m, BigDecimal l1, BigDecimal l2, BigDecimal fixedCost) {
        BigDecimal numerator = q1.multiply(l1).add(fixedCost.divide(n, 8, RoundingMode.HALF_UP));
        BigDecimal denominator = r2.multiply(q1.add(q2).multiply(m))
                .subtract(BigDecimal.ONE.subtract(r2).multiply(q2).multiply(l2))
                .add(q1.multiply(l1));
        return divide(numerator, denominator);
    }

    private List<String> dataGaps(BigDecimal q1, BigDecimal q2, BigDecimal unitMargin,
                                  BigDecimal l1, BigDecimal l2, int localProductCount, String source) {
        List<String> gaps = new ArrayList<>();
        if (localProductCount == 0) gaps.add("未匹配到本地产品标签 cohort，N 可能只来自报表行，零销量 SKU 会被漏计。");
        if (q1 == null) gaps.add("缺少首批备货数量 q1。");
        if (q2 == null) gaps.add("缺少二批备货数量 q2。");
        if (unitMargin == null) gaps.add("未传 unitMargin，当前用报表平均毛利/件临时代替 M。");
        if (l1 == null) gaps.add("缺少首批淘汰单件损失 firstBatchLoss。");
        if (l2 == null) gaps.add("缺少二批淘汰单件损失 secondBatchLoss。");
        if ("performance".equals(source)) gaps.add("performance 是时间窗报表，若同步窗口重叠，销量/利润可能重复计入；严肃复盘建议用 profit 逐日源。");
        gaps.add("当前缺少补货流水/到货日期/每日库存，R2 暂按销量阈值 + 淘汰标签近似。");
        return gaps;
    }

    private BigDecimal ratio(int numerator, int denominator) {
        if (denominator <= 0) return BigDecimal.ZERO;
        return BigDecimal.valueOf(numerator).divide(BigDecimal.valueOf(denominator), 8, RoundingMode.HALF_UP);
    }

    private BigDecimal divide(BigDecimal numerator, BigDecimal denominator) {
        if (denominator == null || denominator.compareTo(BigDecimal.ZERO) <= 0) return null;
        return numerator.divide(denominator, 8, RoundingMode.HALF_UP);
    }

    private String pct(BigDecimal value) {
        if (value == null) return null;
        return value.multiply(BigDecimal.valueOf(100)).setScale(2, RoundingMode.HALF_UP) + "%";
    }

    private BigDecimal money(BigDecimal value) {
        if (value == null) return null;
        return value.setScale(4, RoundingMode.HALF_UP);
    }

    private LocalDate readDate(Map<String, Object> req, String key, LocalDate defaultValue) {
        String value = readString(req, key, null);
        return StringUtils.hasText(value) ? LocalDate.parse(value) : defaultValue;
    }

    private String readString(Map<String, Object> req, String key, String defaultValue) {
        Object value = req.get(key);
        if (value == null) return defaultValue;
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? defaultValue : text;
    }

    private int readInt(Map<String, Object> req, String key, int defaultValue) {
        Object value = req.get(key);
        if (value == null) return defaultValue;
        if (value instanceof Number n) return n.intValue();
        try {
            return Integer.parseInt(String.valueOf(value).trim());
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }

    private BigDecimal readDecimal(Map<String, Object> req, String key, BigDecimal defaultValue) {
        Object value = req.get(key);
        if (value == null) return defaultValue;
        if (value instanceof BigDecimal bd) return bd;
        if (value instanceof Number n) return BigDecimal.valueOf(n.doubleValue());
        String text = String.valueOf(value).trim();
        if (text.isEmpty()) return defaultValue;
        return new BigDecimal(text);
    }

    private boolean contains(String text, String token) {
        return StringUtils.hasText(text) && StringUtils.hasText(token) && text.contains(token);
    }

    private String firstText(String... values) {
        for (String value : values) {
            if (StringUtils.hasText(value)) return value;
        }
        return null;
    }

    private Map<String, Object> mapOf(Object... pairs) {
        Map<String, Object> out = new LinkedHashMap<>();
        for (int i = 0; i + 1 < pairs.length; i += 2) {
            out.put(String.valueOf(pairs[i]), pairs[i + 1]);
        }
        return out;
    }

    private static class SkuAggregate {
        private String sku;
        private String asin;
        private String itemName;
        private int volume;
        private BigDecimal amount = BigDecimal.ZERO;
        private BigDecimal grossProfit = BigDecimal.ZERO;
        private BigDecimal adSpend = BigDecimal.ZERO;
        private boolean targetTagged;
        private boolean pendingElimination;
        private boolean eliminated;
        private String rawText = "";

        static SkuAggregate fromLocalProduct(LingxingLocalProduct p, String pendingTag, String eliminatedTag) {
            SkuAggregate row = new SkuAggregate();
            row.sku = p.getSku();
            row.itemName = p.getProductName();
            row.mergeLocal(p, pendingTag, eliminatedTag);
            return row;
        }

        static SkuAggregate fromPerformance(LingxingProductPerformance p, LingxingLocalProduct local,
                                            String pendingTag, String eliminatedTag) {
            SkuAggregate row = new SkuAggregate();
            row.sku = p.getSku();
            row.asin = p.getAsin();
            row.itemName = p.getItemName();
            if (local != null) row.mergeLocal(local, pendingTag, eliminatedTag);
            return row;
        }

        static SkuAggregate fromProfit(LingxingProfitAsin p, LingxingLocalProduct local,
                                       String pendingTag, String eliminatedTag) {
            SkuAggregate row = new SkuAggregate();
            row.sku = p.getLocalSku();
            row.asin = p.getAsin();
            row.itemName = firstNonBlank(p.getItemName(), p.getLocalName());
            if (local != null) row.mergeLocal(local, pendingTag, eliminatedTag);
            return row;
        }

        void add(LingxingProductPerformance p) {
            if (!StringUtils.hasText(sku)) sku = p.getSku();
            if (!StringUtils.hasText(asin)) asin = p.getAsin();
            if (!StringUtils.hasText(itemName)) itemName = p.getItemName();
            volume += nz(p.getVolume());
            amount = amount.add(nz(p.getAmount()));
            grossProfit = grossProfit.add(nz(p.getGrossProfit()));
            adSpend = adSpend.add(nz(p.getSpend()));
        }

        void add(LingxingProfitAsin p) {
            if (!StringUtils.hasText(sku)) sku = p.getLocalSku();
            if (!StringUtils.hasText(asin)) asin = p.getAsin();
            if (!StringUtils.hasText(itemName)) itemName = firstNonBlank(p.getItemName(), p.getLocalName());
            volume += nz(p.getTotalSalesQuantity());
            amount = amount.add(nz(p.getTotalSalesAmount()));
            grossProfit = grossProfit.add(nz(p.getGrossProfit()));
            adSpend = adSpend.add(nz(p.getTotalAdsCost()));
        }

        void mergeLocal(LingxingLocalProduct p, String pendingTag, String eliminatedTag) {
            if (!StringUtils.hasText(sku)) sku = p.getSku();
            if (!StringUtils.hasText(itemName)) itemName = p.getProductName();
            mergeRaw(p.getRawJson(), pendingTag, eliminatedTag);
        }

        void mergeRaw(String rawJson, String pendingTag, String eliminatedTag) {
            if (!StringUtils.hasText(rawJson)) return;
            rawText += rawJson;
            pendingElimination = pendingElimination || rawJson.contains(pendingTag);
            eliminated = eliminated || (rawJson.contains(eliminatedTag) && !rawJson.contains(pendingTag));
        }

        Map<String, Object> toMap() {
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("sku", sku);
            out.put("asin", asin);
            out.put("itemName", itemName);
            out.put("volume", volume);
            out.put("amount", amount.setScale(4, RoundingMode.HALF_UP));
            out.put("grossProfit", grossProfit.setScale(4, RoundingMode.HALF_UP));
            out.put("adSpend", adSpend.setScale(4, RoundingMode.HALF_UP));
            out.put("pendingElimination", pendingElimination);
            out.put("eliminated", eliminated);
            return out;
        }

        int getVolume() {
            return volume;
        }

        String getSku() {
            return sku;
        }

        BigDecimal getAmount() {
            return amount;
        }

        BigDecimal getGrossProfit() {
            return grossProfit;
        }

        BigDecimal getAdSpend() {
            return adSpend;
        }

        private static int nz(Integer value) {
            return value == null ? 0 : value;
        }

        private static BigDecimal nz(BigDecimal value) {
            return value == null ? BigDecimal.ZERO : value;
        }

        private static String firstNonBlank(String a, String b) {
            return StringUtils.hasText(a) ? a : b;
        }
    }
}
