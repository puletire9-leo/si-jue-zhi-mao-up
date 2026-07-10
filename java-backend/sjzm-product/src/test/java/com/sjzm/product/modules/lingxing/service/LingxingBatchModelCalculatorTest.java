package com.sjzm.product.modules.lingxing.service;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class LingxingBatchModelCalculatorTest {

    private final LingxingBatchModelCalculator calculator = new LingxingBatchModelCalculator();

    @Test
    void usesTheSecondPurchaseBatchAsTheObservedQ2Event() {
        var purchases = List.of(
                purchase("SKU-A", "PO-1", 10L, "2026-04-01", 10, 10),
                purchase("SKU-A", "PO-2", 20L, "2026-04-20", 20, 20),
                purchase("SKU-B", "PO-3", 30L, "2026-04-02", 15, 15)
        );
        var weekly = List.of(
                weekly("SKU-A", "2026-04-06", 5, 10, ""),
                weekly("SKU-A", "2026-04-27", 25, 50, ""),
                weekly("SKU-A", "2026-05-04", 10, 20, ""),
                weekly("SKU-B", "2026-04-06", 1, 2, "")
        );

        Map<String, Object> result = calculator.calculate(
                purchases,
                weekly,
                2,
                new LingxingBatchModelCalculator.Parameters(20, 2, null, null,
                        BigDecimal.TEN, BigDecimal.ONE, BigDecimal.ONE, BigDecimal.ZERO));

        assertThat(result.get("modelSkuCount")).isEqualTo(2);
        assertThat(result.get("q2SkuCount")).isEqualTo(1);
        assertThat(result.get("r1")).isEqualTo("50.00%");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> rows = (List<Map<String, Object>>) result.get("rows");
        assertThat(rows.get(0)).containsEntry("sku", "SKU-A").containsEntry("q2OrderSn", "PO-2");
        assertThat(rows.get(0)).containsEntry("q1Qty", 10).containsEntry("q2Qty", 20);
    }

    @Test
    void excludesImmatureQ2RowsFromR2() {
        var purchases = List.of(
                purchase("SKU-A", "PO-1", 10L, "2026-04-01", 10, 10),
                purchase("SKU-A", "PO-2", 20L, "2026-04-20", 20, 20)
        );
        var weekly = List.of(
                weekly("SKU-A", "2026-04-27", 25, 50, "")
        );

        Map<String, Object> result = calculator.calculate(
                purchases,
                weekly,
                1,
                new LingxingBatchModelCalculator.Parameters(20, 4, null, null,
                        BigDecimal.TEN, BigDecimal.ONE, BigDecimal.ONE, BigDecimal.ZERO));

        assertThat(result.get("q2SkuCount")).isEqualTo(1);
        assertThat(result.get("r2EligibleSkuCount")).isEqualTo(0);
        assertThat(result.get("r2")).isEqualTo("N/A");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> rows = (List<Map<String, Object>>) result.get("rows");
        assertThat(rows.get(0).get("dataQualityFlags")).asList()
                .contains("Q2_OBSERVATION_INSUFFICIENT");
    }

    @Test
    void doesNotClaimNetProfitWithoutLossInputs() {
        var purchases = List.of(
                purchase("SKU-A", "PO-1", 10L, "2026-04-01", 10, 10),
                purchase("SKU-A", "PO-2", 20L, "2026-04-20", 20, 20)
        );

        Map<String, Object> result = calculator.calculate(
                purchases,
                List.of(),
                1,
                new LingxingBatchModelCalculator.Parameters(20, 0, null, null,
                        BigDecimal.TEN, null, null, BigDecimal.ZERO));

        @SuppressWarnings("unchecked")
        Map<String, Object> model = (Map<String, Object>) result.get("model");
        assertThat(model.get("complete")).isEqualTo(false);
        assertThat(model).doesNotContainKey("netProfit");
    }

    @Test
    void aggregatesMultipleMarketplaceRowsBeforeCountingObservationWeeks() {
        var purchases = List.of(
                purchase("SKU-A", "PO-1", 10L, "2026-04-01", 10, 10),
                purchase("SKU-A", "PO-2", 20L, "2026-04-20", 20, 20)
        );
        var weekly = List.of(
                weekly("SKU-A", "2026-04-27", 5, 10, ""),
                new LingxingBatchModelCalculator.WeeklyFact(
                        "SKU-A", LocalDate.parse("2026-04-27"), LocalDate.parse("2026-05-03"),
                        3, BigDecimal.valueOf(6), 0, "", null, "DE"),
                weekly("SKU-A", "2026-05-04", 5, 10, "")
        );

        Map<String, Object> result = calculator.calculate(
                purchases,
                weekly,
                1,
                new LingxingBatchModelCalculator.Parameters(20, 2, null, null,
                        BigDecimal.TEN, BigDecimal.ONE, BigDecimal.ONE, BigDecimal.ZERO));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> rows = (List<Map<String, Object>>) result.get("rows");
        assertThat(rows.get(0).get("postQ2ObservationWeeks")).isEqualTo(2);
        assertThat(rows.get(0).get("stockoutWeek")).isNull();
    }

    private static LingxingBatchModelCalculator.PurchaseFact purchase(
            String sku, String orderSn, long itemId, String date, int quantityReal, int quantityEntry) {
        return new LingxingBatchModelCalculator.PurchaseFact(
                sku, orderSn, itemId, LocalDateTime.parse(date + "T09:00:00"),
                null, 1L, quantityReal, quantityEntry, 0, 9, 3);
    }

    private static LingxingBatchModelCalculator.WeeklyFact weekly(
            String sku, String weekStart, int volume, int grossProfit, String tags) {
        LocalDate start = LocalDate.parse(weekStart);
        return new LingxingBatchModelCalculator.WeeklyFact(
                sku, start, start.plusDays(6), volume, BigDecimal.valueOf(grossProfit),
                10, tags, null, "UK");
    }
}
