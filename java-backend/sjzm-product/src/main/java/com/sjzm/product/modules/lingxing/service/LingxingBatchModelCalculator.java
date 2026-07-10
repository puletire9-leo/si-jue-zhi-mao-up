package com.sjzm.product.modules.lingxing.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;

/**
 * First-pass SKU batch model. It intentionally keeps the uncertain joins and
 * observation rules visible in the result instead of silently filling them.
 */
public final class LingxingBatchModelCalculator {

    public record PurchaseFact(
            String sku,
            String orderSn,
            Long itemId,
            LocalDateTime orderTime,
            Long sid,
            Long wid,
            Integer quantityReal,
            Integer quantityEntry,
            Integer quantityReceive,
            Integer status,
            Integer statusShipped) {
    }

    public record WeeklyFact(
            String sku,
            LocalDate weekStart,
            LocalDate weekEnd,
            Integer volume,
            BigDecimal grossProfit,
            Integer afnFulfillableQuantity,
            String tags,
            Long sid,
            String marketplace) {
    }

    public record Parameters(
            int turnoverUnitsThreshold,
            int minObservationWeeks,
            BigDecimal scenarioQ1,
            BigDecimal scenarioQ2,
            BigDecimal unitMargin,
            BigDecimal firstBatchLoss,
            BigDecimal secondBatchLoss,
            BigDecimal fixedCost) {
    }

    public Map<String, Object> calculate(List<PurchaseFact> purchases,
                                          List<WeeklyFact> weeklyFacts,
                                          long targetSkuCount,
                                          Parameters parameters) {
        Map<String, List<PurchaseFact>> purchaseBySku = purchases.stream()
                .filter(this::isValidPurchase)
                .filter(row -> hasText(row.sku()))
                .collect(Collectors.groupingBy(PurchaseFact::sku, LinkedHashMap::new, Collectors.toList()));
        Map<String, List<WeeklyFact>> weeklyBySku = weeklyFacts.stream()
                .filter(row -> hasText(row.sku()))
                .collect(Collectors.groupingBy(WeeklyFact::sku, LinkedHashMap::new, Collectors.toList()));

        List<SkuBatch> batches = new ArrayList<>();
        for (Map.Entry<String, List<PurchaseFact>> entry : purchaseBySku.entrySet()) {
            List<PurchaseFact> ordered = entry.getValue().stream()
                    .sorted(Comparator.comparing(PurchaseFact::orderTime,
                                    Comparator.nullsLast(Comparator.naturalOrder()))
                            .thenComparing(PurchaseFact::orderSn,
                                    Comparator.nullsLast(String::compareTo))
                            .thenComparing(PurchaseFact::itemId,
                                    Comparator.nullsLast(Long::compareTo)))
                    .toList();
            if (ordered.isEmpty()) continue;
            batches.add(buildBatch(ordered.get(0), ordered.size() > 1 ? ordered.get(1) : null,
                    weeklyBySku.getOrDefault(entry.getKey(), List.of()), parameters));
        }
        batches.sort(Comparator.comparing(SkuBatch::sku));

        int modelSkuCount = batches.size();
        int q2SkuCount = (int) batches.stream().filter(row -> row.q2 != null).count();
        int q2EligibleSkuCount = (int) batches.stream().filter(SkuBatch::q2ObservationEligible).count();
        int q2TurnedSkuCount = (int) batches.stream().filter(SkuBatch::turnedPositive).count();
        int q1SaleSkuCount = (int) batches.stream().filter(row -> row.q1Volume > 0).count();
        int totalVolume = batches.stream().mapToInt(row -> row.totalVolume).sum();
        BigDecimal totalGrossProfit = batches.stream()
                .map(row -> row.totalGrossProfit)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal observedUnitMargin = totalVolume > 0
                ? totalGrossProfit.divide(BigDecimal.valueOf(totalVolume), 8, RoundingMode.HALF_UP)
                : null;
        BigDecimal averageQ1 = average(batches.stream()
                .map(row -> row.q1.quantityReal()).toList());
        BigDecimal averageQ2 = average(batches.stream()
                .filter(row -> row.q2 != null)
                .map(row -> row.q2.quantityReal()).toList());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("targetSkuCount", targetSkuCount);
        result.put("modelSkuCount", modelSkuCount);
        result.put("q1SkuCount", modelSkuCount);
        result.put("q2SkuCount", q2SkuCount);
        result.put("q2EligibleSkuCount", q2EligibleSkuCount);
        result.put("r2EligibleSkuCount", q2EligibleSkuCount);
        result.put("q2TurnedSkuCount", q2TurnedSkuCount);
        result.put("q1SaleSkuCount", q1SaleSkuCount);
        result.put("q1CoverageRate", pct(modelSkuCount, targetSkuCount));
        result.put("r1", pct(q2SkuCount, modelSkuCount));
        result.put("r2", q2EligibleSkuCount == 0 ? "N/A" : pct(q2TurnedSkuCount, q2EligibleSkuCount));
        result.put("q1SaleRate", pct(q1SaleSkuCount, modelSkuCount));
        result.put("q1QtyTotal", sumQuantity(batches, true, false));
        result.put("q1EntryTotal", sumQuantity(batches, true, true));
        result.put("q2QtyTotal", sumQuantity(batches, false, false));
        result.put("q2EntryTotal", sumQuantity(batches, false, true));
        result.put("totalVolume", totalVolume);
        result.put("totalGrossProfit", money(totalGrossProfit));
        result.put("observedUnitMargin", money(observedUnitMargin));
        result.put("averageQ1Qty", money(averageQ1));
        result.put("averageQ2Qty", money(averageQ2));
        result.put("parameters", parametersToMap(parameters));
        result.put("model", buildProfitModel(modelSkuCount, averageQ1, averageQ2,
                observedUnitMargin, parameters, q2TurnedSkuCount, q2EligibleSkuCount, q2SkuCount));
        result.put("rows", batches.stream().map(SkuBatch::toMap).toList());
        return result;
    }

    private SkuBatch buildBatch(PurchaseFact q1, PurchaseFact q2,
                                List<WeeklyFact> weekly, Parameters parameters) {
        List<WeeklyFact> orderedWeekly = weekly.stream()
                .sorted(Comparator.comparing(WeeklyFact::weekStart,
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
        LocalDate q2Date = q2 == null || q2.orderTime() == null ? null : q2.orderTime().toLocalDate();
        int q1Volume = 0;
        int postQ2Volume = 0;
        int totalVolume = 0;
        int postQ2ObservationWeeks = 0;
        BigDecimal totalGrossProfit = BigDecimal.ZERO;
        LocalDate firstFbaActiveWeek = null;
        LocalDate firstSaleWeek = null;
        LocalDate stockoutWeek = null;
        boolean seenFbaActive = false;
        boolean eliminated = false;
        boolean pendingElimination = false;
        Set<String> marketplaces = new TreeSet<>();

        for (WeeklyFact fact : orderedWeekly) {
            int volume = nz(fact.volume());
            totalVolume += volume;
            totalGrossProfit = totalGrossProfit.add(nz(fact.grossProfit()));
            if (hasText(fact.marketplace())) marketplaces.add(fact.marketplace());
            if (volume > 0 && firstSaleWeek == null) firstSaleWeek = fact.weekStart();
            if (fact.afnFulfillableQuantity() != null && fact.afnFulfillableQuantity() > 0) {
                seenFbaActive = true;
                if (firstFbaActiveWeek == null) firstFbaActiveWeek = fact.weekStart();
            } else if (seenFbaActive && fact.afnFulfillableQuantity() != null
                    && fact.afnFulfillableQuantity() <= 0 && stockoutWeek == null) {
                stockoutWeek = fact.weekStart();
            }
            if (contains(fact.tags(), "淘汰")) {
                pendingElimination = pendingElimination || contains(fact.tags(), "待淘汰");
                eliminated = eliminated || !contains(fact.tags(), "待淘汰");
            }
            boolean afterQ2 = q2Date != null && fact.weekEnd() != null && !fact.weekEnd().isBefore(q2Date);
            if (afterQ2) {
                postQ2Volume += volume;
                postQ2ObservationWeeks++;
            } else {
                q1Volume += volume;
            }
        }

        List<String> flags = new ArrayList<>();
        if (q1.sid() == null || q1.sid() == 0) flags.add("PURCHASE_SID_MISSING");
        if (weekly.stream().anyMatch(row -> row.sid() == null || row.sid() == 0)) {
            flags.add("PERFORMANCE_SID_MISSING");
        }
        if (marketplaces.size() > 1) flags.add("MULTI_MARKETPLACE_MIXED");
        if (q2 == null) flags.add("Q2_NOT_FOUND");
        if (weekly.isEmpty()) flags.add("NO_WEEKLY_PERFORMANCE");
        if (firstFbaActiveWeek == null) flags.add("FBA_ACTIVE_WEEK_MISSING");
        if (firstSaleWeek == null) flags.add("FIRST_SALE_WEEK_MISSING");
        if (q2 != null && postQ2ObservationWeeks < parameters.minObservationWeeks()) {
            flags.add("Q2_OBSERVATION_INSUFFICIENT");
        }
        if (eliminated) flags.add("ELIMINATED_TAG");

        return new SkuBatch(q1.sku(), q1, q2, q1Volume, postQ2Volume, totalVolume,
                totalGrossProfit, postQ2ObservationWeeks, firstFbaActiveWeek, firstSaleWeek,
                stockoutWeek, eliminated, pendingElimination, marketplaces, flags, parameters);
    }

    private Map<String, Object> buildProfitModel(int n, BigDecimal averageQ1, BigDecimal averageQ2,
                                                   BigDecimal observedUnitMargin, Parameters parameters,
                                                   int turnedSkuCount, int eligibleQ2SkuCount, int q2SkuCount) {
        BigDecimal q1 = parameters.scenarioQ1() != null ? parameters.scenarioQ1() : averageQ1;
        BigDecimal q2 = parameters.scenarioQ2() != null ? parameters.scenarioQ2() : averageQ2;
        BigDecimal margin = parameters.unitMargin() != null ? parameters.unitMargin() : observedUnitMargin;
        Map<String, Object> model = new LinkedHashMap<>();
        Map<String, Object> inputs = new LinkedHashMap<>();
        inputs.put("n", n);
        inputs.put("q1", money(q1));
        inputs.put("q2", money(q2));
        inputs.put("unitMargin", money(margin));
        inputs.put("firstBatchLoss", parameters.firstBatchLoss());
        inputs.put("secondBatchLoss", parameters.secondBatchLoss());
        inputs.put("fixedCost", parameters.fixedCost());
        model.put("inputs", inputs);
        model.put("r1Source", "actual second purchase batch / Q1 SKU");
        model.put("r2Source", "post-Q2 observed volume / mature Q2 SKU");
        model.put("q2SkuCount", q2SkuCount);
        model.put("q2EligibleSkuCount", eligibleQ2SkuCount);
        model.put("q2TurnedSkuCount", turnedSkuCount);

        boolean complete = n > 0 && q1 != null && q2 != null && margin != null
                && parameters.firstBatchLoss() != null && parameters.secondBatchLoss() != null
                && parameters.fixedCost() != null;
        model.put("complete", complete);
        if (!complete) {
            model.put("message", "已输出真实批次和生命周期统计；补齐 firstBatchLoss/secondBatchLoss 后才计算净利润。");
            return model;
        }

        BigDecimal r1 = ratio(q2SkuCount, n);
        BigDecimal r2 = ratio(turnedSkuCount, eligibleQ2SkuCount);
        BigDecimal nBd = BigDecimal.valueOf(n);
        BigDecimal one = BigDecimal.ONE;
        BigDecimal q1PlusQ2 = q1.add(q2);
        BigDecimal netProfit = nBd.multiply(r1).multiply(r2).multiply(q1PlusQ2).multiply(margin)
                .subtract(nBd.multiply(one.subtract(r1)).multiply(q1).multiply(parameters.firstBatchLoss()))
                .subtract(nBd.multiply(r1).multiply(one.subtract(r2)).multiply(q2)
                        .multiply(parameters.secondBatchLoss()))
                .subtract(parameters.fixedCost());
        BigDecimal minR1 = divide(
                q1.multiply(parameters.firstBatchLoss())
                        .add(parameters.fixedCost().divide(nBd, 8, RoundingMode.HALF_UP)),
                q1PlusQ2.multiply(margin).add(q1.multiply(parameters.firstBatchLoss())));
        model.put("r1", pct(r1));
        model.put("r2", eligibleQ2SkuCount == 0 ? "N/A" : pct(r2));
        model.put("netProfit", money(netProfit));
        model.put("breakEven", netProfit.compareTo(BigDecimal.ZERO) >= 0);
        model.put("minimumR1", pct(minR1));
        return model;
    }

    private boolean isValidPurchase(PurchaseFact row) {
        return row.quantityReal() != null && row.quantityReal() > 0
                && row.status() != null && row.status() == 9
                && row.statusShipped() != null && row.statusShipped() == 3;
    }

    private int sumQuantity(List<SkuBatch> rows, boolean first, boolean entry) {
        return rows.stream().mapToInt(row -> {
            PurchaseFact fact = first ? row.q1 : row.q2;
            if (fact == null) return 0;
            Integer value = entry ? fact.quantityEntry() : fact.quantityReal();
            return nz(value);
        }).sum();
    }

    private Map<String, Object> parametersToMap(Parameters parameters) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("turnoverUnitsThreshold", parameters.turnoverUnitsThreshold());
        out.put("minObservationWeeks", parameters.minObservationWeeks());
        out.put("scenarioQ1", money(parameters.scenarioQ1()));
        out.put("scenarioQ2", money(parameters.scenarioQ2()));
        out.put("unitMargin", money(parameters.unitMargin()));
        out.put("firstBatchLoss", money(parameters.firstBatchLoss()));
        out.put("secondBatchLoss", money(parameters.secondBatchLoss()));
        out.put("fixedCost", money(parameters.fixedCost()));
        return out;
    }

    private BigDecimal average(List<Integer> values) {
        if (values.isEmpty()) return null;
        var average = values.stream().mapToInt(this::nz).average();
        return average.isPresent()
                ? BigDecimal.valueOf(average.getAsDouble()).setScale(4, RoundingMode.HALF_UP)
                : null;
    }

    private String pct(int numerator, long denominator) {
        if (denominator <= 0) return "N/A";
        return BigDecimal.valueOf(numerator)
                .divide(BigDecimal.valueOf(denominator), 6, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100))
                .setScale(2, RoundingMode.HALF_UP) + "%";
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
        if (value == null) return "N/A";
        return value.multiply(BigDecimal.valueOf(100)).setScale(2, RoundingMode.HALF_UP) + "%";
    }

    private BigDecimal money(BigDecimal value) {
        return value == null ? null : value.setScale(4, RoundingMode.HALF_UP);
    }

    private int nz(Integer value) {
        return value == null ? 0 : value;
    }

    private BigDecimal nz(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private boolean contains(String text, String token) {
        return text != null && token != null && text.contains(token);
    }

    private record SkuBatch(
            String sku,
            PurchaseFact q1,
            PurchaseFact q2,
            int q1Volume,
            int postQ2Volume,
            int totalVolume,
            BigDecimal totalGrossProfit,
            int postQ2ObservationWeeks,
            LocalDate firstFbaActiveWeek,
            LocalDate firstSaleWeek,
            LocalDate stockoutWeek,
            boolean eliminated,
            boolean pendingElimination,
            Set<String> marketplaces,
            List<String> dataQualityFlags,
            Parameters parameters) {

        boolean q2ObservationEligible() {
            return q2 != null && postQ2ObservationWeeks >= parameters.minObservationWeeks();
        }

        boolean turnedPositive() {
            return q2ObservationEligible() && postQ2Volume >= parameters.turnoverUnitsThreshold() && !eliminated;
        }

        Map<String, Object> toMap() {
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("sku", sku);
            out.put("q1OrderSn", q1.orderSn());
            out.put("q1OrderTime", q1.orderTime());
            out.put("q1Qty", q1.quantityReal());
            out.put("q1Entry", q1.quantityEntry());
            out.put("q2OrderSn", q2 == null ? null : q2.orderSn());
            out.put("q2OrderTime", q2 == null ? null : q2.orderTime());
            out.put("q2Qty", q2 == null ? null : q2.quantityReal());
            out.put("q2Entry", q2 == null ? null : q2.quantityEntry());
            out.put("q1Volume", q1Volume);
            out.put("postQ2Volume", postQ2Volume);
            out.put("totalVolume", totalVolume);
            out.put("totalGrossProfit", totalGrossProfit.setScale(4, RoundingMode.HALF_UP));
            out.put("postQ2ObservationWeeks", postQ2ObservationWeeks);
            out.put("firstFbaActiveWeek", firstFbaActiveWeek);
            out.put("firstSaleWeek", firstSaleWeek);
            out.put("stockoutWeek", stockoutWeek);
            out.put("enteredQ2", q2 != null);
            out.put("turnedPositive", turnedPositive());
            out.put("eliminated", eliminated);
            out.put("pendingElimination", pendingElimination);
            out.put("performanceMarketplaces", marketplaces);
            out.put("dataQualityFlags", dataQualityFlags);
            return out;
        }
    }
}
