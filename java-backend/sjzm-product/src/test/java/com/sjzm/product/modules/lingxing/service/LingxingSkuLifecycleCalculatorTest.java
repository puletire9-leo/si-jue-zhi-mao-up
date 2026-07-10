package com.sjzm.product.modules.lingxing.service;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class LingxingSkuLifecycleCalculatorTest {

    private final LingxingSkuLifecycleCalculator calculator = new LingxingSkuLifecycleCalculator();

    @Test
    void buildsMultiplePurchaseBatchesAndStockoutGaps() {
        var purchases = List.of(
                purchase("PO-1", "2026-04-30", 10, 10),
                purchase("PO-2", "2026-05-15", 20, 20),
                purchase("PO-3", "2026-06-20", 30, 30)
        );
        var weekly = List.of(
                weekly("2026-05-01", 10, 2, 4),
                weekly("2026-05-08", 5, 5, 10),
                weekly("2026-05-15", 0, 3, 6),
                weekly("2026-05-22", 20, 8, 16),
                weekly("2026-06-01", 5, 6, 12),
                weekly("2026-06-08", 0, 4, 8),
                weekly("2026-06-22", 30, 10, 20)
        );

        Map<String, Object> result = calculator.calculate(
                "UK", "SKU-A", purchases, weekly, LocalDate.parse("2026-07-07"));

        assertThat(result).containsEntry("batchCount", 3)
                .containsEntry("replenishmentCount", 2)
                .containsEntry("currentState", "IN_STOCK")
                .containsEntry("firstActiveWeek", LocalDate.parse("2026-05-01"))
                .containsEntry("firstSaleWeek", LocalDate.parse("2026-05-01"));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> batches = (List<Map<String, Object>>) result.get("batches");
        assertThat(batches).hasSize(3);
        assertThat(batches.get(0)).containsEntry("batchNo", 1)
                .containsEntry("batchVolume", 7)
                .containsEntry("selloutWeek", LocalDate.parse("2026-05-15"))
                .containsEntry("nextOrderSn", "PO-2");
        assertThat(batches.get(0).get("stockoutWeeks")).isEqualTo(1L);
        assertThat(batches.get(1)).containsEntry("batchNo", 2)
                .containsEntry("batchVolume", 19)
                .containsEntry("selloutWeek", LocalDate.parse("2026-06-08"))
                .containsEntry("nextOrderSn", "PO-3");
        assertThat(batches.get(1).get("stockoutWeeks")).isEqualTo(2L);
        assertThat(batches.get(2)).containsEntry("batchNo", 3)
                .containsEntry("batchVolume", 10)
                .containsEntry("batchStatus", "CURRENT");
    }

    @Test
    void keepsUnknownInventorySeparateFromStockout() {
        var purchases = List.of(purchase("PO-1", "2026-05-01", 15, 15));
        var weekly = List.of(
                weekly("2026-05-01", 10, 2, 4),
                new LingxingSkuLifecycleCalculator.WeeklyFact(
                        LocalDate.parse("2026-05-08"), LocalDate.parse("2026-05-14"),
                        0, BigDecimal.ZERO, null, 0)
        );

        Map<String, Object> result = calculator.calculate(
                "UK", "SKU-B", purchases, weekly, LocalDate.parse("2026-05-14"));

        assertThat(result).containsEntry("currentState", "INVENTORY_UNKNOWN");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> batches = (List<Map<String, Object>>) result.get("batches");
        assertThat(batches.get(0)).containsEntry("selloutWeek", null);
    }

    private static LingxingSkuLifecycleCalculator.PurchaseFact purchase(
            String orderSn, String date, int quantityReal, int quantityEntry) {
        return new LingxingSkuLifecycleCalculator.PurchaseFact(
                orderSn, LocalDateTime.parse(date + "T09:00:00"),
                quantityReal, quantityEntry, null, 1L);
    }

    private static LingxingSkuLifecycleCalculator.WeeklyFact weekly(
            String start, int afnQuantity, int volume, int grossProfit) {
        LocalDate weekStart = LocalDate.parse(start);
        return new LingxingSkuLifecycleCalculator.WeeklyFact(
                weekStart, weekStart.plusDays(6), volume,
                BigDecimal.valueOf(grossProfit), afnQuantity, 7);
    }
}
