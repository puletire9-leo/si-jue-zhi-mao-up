package com.sjzm.product.modules.lingxing.service;

import com.sjzm.product.modules.lingxing.entity.LingxingProductPerformanceDaily;
import com.sjzm.product.modules.lingxing.entity.LingxingProductUnified;
import com.sjzm.product.modules.lingxing.dto.FinanceDailyReportRow;
import com.sjzm.product.rds.finance.model.FinanceStatusSnapshotRow;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class LingxingFinanceDailyReportServiceTest {

    private final LingxingFinanceDailyReportService service =
            new LingxingFinanceDailyReportService(null, null, null, null, null, null, null, null);

    private static final List<String> TEST_DEVELOPERS = List.of(
            "蒋舒", "陈杨", "宋凤莉", "刘淼", "龙梦临", "周沁仪", "黄雨珊", "夏浩宇");
    private static final List<String> TEST_OPERATORS = List.of(
            "阳姣", "张奋奋", "尹心如", "余江燕", "李微微");

    @Test
    void rowMetricsUsesPositiveRefundAmountAndHistoricalSale() {
        LingxingProductPerformanceDaily fact = new LingxingProductPerformanceDaily();
        fact.setAfnFulfillableQuantity(0);
        fact.setVolume(0);
        fact.setReturnAmount(new BigDecimal("-12.34"));

        Map<String, BigDecimal> metrics = service.rowMetrics(
                fact, true, LocalDate.of(2026, 1, 1), LocalDate.of(2026, 8, 10), "");

        assertThat(metrics.get("退款金额")).isEqualByComparingTo("12.34");
        assertThat(metrics.get("断货SKU")).isEqualByComparingTo(BigDecimal.ONE);
        assertThat(metrics.get("未上架SKU")).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void rowMetricsMarksReStockoutWhenProductSoldBeforeButNotToday() {
        LingxingProductPerformanceDaily fact = new LingxingProductPerformanceDaily();
        fact.setAsin("B0H1BFVQFP");
        fact.setAfnFulfillableQuantity(0);
        fact.setVolume(0);

        Map<String, BigDecimal> metrics = service.rowMetrics(
                fact, true, LocalDate.of(2026, 1, 1), LocalDate.of(2026, 8, 2), "");

        assertThat(metrics.get("断货SKU")).isEqualByComparingTo(BigDecimal.ONE);
        assertThat(metrics.get("未上架SKU")).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void rowMetricsTreatsMissingRefundAsZero() {
        LingxingProductPerformanceDaily fact = new LingxingProductPerformanceDaily();
        fact.setAfnFulfillableQuantity(1);
        fact.setVolume(0);

        Map<String, BigDecimal> metrics = service.rowMetrics(
                fact, false, LocalDate.of(2026, 1, 1), LocalDate.of(2026, 8, 10), "");

        assertThat(metrics.get("退款金额")).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(metrics.get("销售额")).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(metrics.get("广告销售额")).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(metrics.get("广告花费")).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void dailyFactWithoutCreateTimeStillCountsAsExistingSku() {
        LingxingProductPerformanceDaily fact = new LingxingProductPerformanceDaily();
        fact.setAfnFulfillableQuantity(1);

        Map<String, BigDecimal> metrics = service.rowMetrics(
                fact, false, null, LocalDate.of(2026, 8, 12), "");

        assertThat(metrics.get("SKU\u603b\u6570\u91cf")).isEqualByComparingTo(BigDecimal.ONE);
    }

    @Test
    void rowMetricsMarksOverNinetyDaysForZeroSalesOrExcessInventory() {
        LingxingProductPerformanceDaily fact = new LingxingProductPerformanceDaily();
        fact.setAfnFulfillableQuantity(181);
        fact.setVolume(2);

        Map<String, BigDecimal> overNinety = service.rowMetrics(
                fact, false, LocalDate.of(2026, 1, 1), LocalDate.of(2026, 8, 10), "");
        assertThat(overNinety.get("动销＞90天的SKU")).isEqualByComparingTo(BigDecimal.ONE);

        fact.setAfnFulfillableQuantity(180);
        Map<String, BigDecimal> exactlyNinety = service.rowMetrics(
                fact, false, LocalDate.of(2026, 1, 1), LocalDate.of(2026, 8, 10), "");
        assertThat(exactlyNinety.get("动销＞90天的SKU")).isEqualByComparingTo(BigDecimal.ZERO);

        fact.setVolume(0);
        Map<String, BigDecimal> zeroSales = service.rowMetrics(
                fact, false, LocalDate.of(2026, 1, 1), LocalDate.of(2026, 8, 10), "");
        assertThat(zeroSales.get("动销＞90天的SKU")).isEqualByComparingTo(BigDecimal.ONE);
    }

    @Test
    void rowMetricsExcludesEliminatedInfringingAndSeasonalRowsFromStockout() {
        LingxingProductPerformanceDaily fact = new LingxingProductPerformanceDaily();
        fact.setAfnFulfillableQuantity(0);
        fact.setVolume(1);

        for (String tags : List.of("欧洲精铺2025淘汰", "欧洲精铺2025待淘汰", "侵权下架", "欧洲精铺2025季节性断货")) {
            Map<String, BigDecimal> metrics = service.rowMetrics(
                    fact, false, LocalDate.of(2026, 1, 1), LocalDate.of(2026, 8, 10), tags);
            assertThat(metrics.get("断货SKU")).as(tags).isEqualByComparingTo(BigDecimal.ZERO);
        }
    }

    @Test
    void rowMetricsCreatesNewStockoutFromCurrentDaySale() {
        LingxingProductPerformanceDaily fact = new LingxingProductPerformanceDaily();
        fact.setAfnFulfillableQuantity(0);
        fact.setVolume(1);

        Map<String, BigDecimal> metrics = service.rowMetrics(
                fact, false, LocalDate.of(2026, 1, 1), LocalDate.of(2026, 8, 10), "");

        assertThat(metrics.get("断货SKU")).isEqualByComparingTo(BigDecimal.ONE);
        assertThat(metrics.get("未上架SKU")).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void rowMetricsExcludesPendingEliminationAndInfringementFromUnlisted() {
        LingxingProductPerformanceDaily fact = new LingxingProductPerformanceDaily();
        fact.setAfnFulfillableQuantity(0);
        fact.setVolume(0);

        for (String tags : List.of("欧洲精铺2025待淘汰", "侵权下架")) {
            Map<String, BigDecimal> metrics = service.rowMetrics(
                    fact, false, LocalDate.of(2026, 1, 1), LocalDate.of(2026, 8, 10), tags);
            assertThat(metrics.get("未上架SKU")).as(tags).isEqualByComparingTo(BigDecimal.ZERO);
        }
    }

    @Test
    void pendingEliminationIsNotCountedAsEliminatedSku() {
        LingxingProductPerformanceDaily fact = new LingxingProductPerformanceDaily();
        fact.setAfnFulfillableQuantity(1);
        fact.setVolume(0);

        Map<String, BigDecimal> metrics = service.rowMetrics(
                fact, false, LocalDate.of(2026, 1, 1), LocalDate.of(2026, 8, 10),
                "欧洲精铺2025待淘汰");

        assertThat(metrics.get("淘汰SKU")).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void consolidatesDuplicateSidBatchRowsBeforeCountingSkuState() {
        LingxingProductPerformanceDaily first = new LingxingProductPerformanceDaily();
        first.setAsin("B000000001");
        first.setMarketplace("UK");
        first.setVolume(1);
        first.setAfnFulfillableQuantity(0);
        first.setAmount(new BigDecimal("10.00"));
        LingxingProductPerformanceDaily second = new LingxingProductPerformanceDaily();
        second.setAsin("B000000001");
        second.setMarketplace("UK");
        second.setVolume(2);
        second.setAfnFulfillableQuantity(3);
        second.setAmount(new BigDecimal("20.00"));

        List<LingxingProductPerformanceDaily> consolidated =
                service.consolidateFactsByAsin(List.of(first, second));

        assertThat(consolidated).hasSize(1);
        assertThat(consolidated.get(0).getVolume()).isEqualTo(3);
        assertThat(consolidated.get(0).getAfnFulfillableQuantity()).isEqualTo(3);
        assertThat(consolidated.get(0).getAmount()).isEqualByComparingTo("30.00");
    }

    @Test
    void combinesUkAndDeFactsAfterLingxingConvertsBothToGbp() {
        LocalDate reportDate = LocalDate.of(2026, 8, 12);
        LingxingProductPerformanceDaily uk = marketplaceFact("B000000001", "UK", 1, "10.00", reportDate);
        LingxingProductPerformanceDaily de = marketplaceFact("B000000001", "DE", 2, "20.00", reportDate);

        List<LingxingProductPerformanceDaily> combined = service.consolidateFactsByAsin(List.of(uk, de));
        LingxingFinanceDailyReportService.ComputedReport report = service.computeReport(
                combined, Map.of(), Map.of(), Map.of(), java.util.Set.of(), reportDate,
                LingxingFinanceDailyReportService.CalculationProfile.PRODUCTION_GBP, "ALL", "GBP",
                TEST_DEVELOPERS, TEST_OPERATORS);

        FinanceDailyReportRow total = totalRow(report.rows());
        assertThat(combined).hasSize(2);
        assertThat(report.rows()).hasSize(4);
        assertThat(total.marketplace()).isEqualTo("ALL");
        assertThat(total.currencyCode()).isEqualTo("GBP");
        assertThat(total.metrics().get("SKU总数量")).isEqualByComparingTo("2");
        assertThat(total.metrics().get("销量")).isEqualByComparingTo("3");
        assertThat(total.metrics().get("销售额")).isEqualByComparingTo("30.00");
    }

    @Test
    void padsMissingUnifiedMarketplaceRowsIntoSkuTotal() {
        LocalDate reportDate = LocalDate.of(2026, 8, 12);
        LingxingProductPerformanceDaily uk = marketplaceFact("B000000001", "UK", 1, "10.00", reportDate);
        List<LingxingProductPerformanceDaily> padded = service.padMissingWhitelistFacts(
                List.of(uk),
                Map.of("UK", java.util.Set.of("B000000001", "B000000002"),
                        "DE", java.util.Set.of("B000000001")),
                reportDate);
        List<LingxingProductPerformanceDaily> combined = service.consolidateFactsByAsin(padded);
        LingxingFinanceDailyReportService.ComputedReport report = service.computeReport(
                combined, Map.of(), Map.of(), Map.of(), java.util.Set.of(), reportDate,
                LingxingFinanceDailyReportService.CalculationProfile.PRODUCTION_GBP, "ALL", "GBP",
                TEST_DEVELOPERS, TEST_OPERATORS);

        assertThat(combined).hasSize(3);
        assertThat(totalRow(report.rows()).metrics().get("SKU总数量")).isEqualByComparingTo("3");
        assertThat(totalRow(report.rows()).metrics().get("销量")).isEqualByComparingTo("1");
    }

    @Test
    void productionUkOnlyOutputsPeoplePresentInCurrentFacts() {
        LocalDate reportDate = LocalDate.of(2026, 8, 12);
        LingxingProductPerformanceDaily first = marketplaceFact(
                "B000000001", "UK", 1, "10.00", reportDate);
        first.setPrincipalNames("阳姣");
        first.setDeveloperNames("刘淼");
        LingxingProductPerformanceDaily second = marketplaceFact(
                "B000000002", "UK", 0, "0.00", reportDate);
        second.setPrincipalNames("张奋奋");

        LingxingFinanceDailyReportService.ComputedReport report = service.computeReport(
                List.of(first, second), Map.of(), Map.of(), Map.of(), java.util.Set.of(), reportDate,
                LingxingFinanceDailyReportService.CalculationProfile.PRODUCTION_GBP, "ALL", "GBP",
                TEST_DEVELOPERS, TEST_OPERATORS);

        assertThat(report.rows()).hasSize(7); // 基础4行 + 运营2行 + 开发1行
        assertThat(report.rows().stream().filter(r -> "运营".equals(r.dimension())))
                .extracting(FinanceDailyReportRow::dimensionValue)
                .containsExactly("阳姣", "张奋奋");
        assertThat(report.rows().stream().filter(r -> "开发".equals(r.dimension())))
                .extracting(FinanceDailyReportRow::dimensionValue)
                .containsExactly("刘淼");
        assertThat(report.rows()).noneMatch(r -> "夏浩宇".equals(r.dimensionValue()));
    }

    @Test
    void productionUsesConfiguredPeopleAndKeepsUnknownFactsInTotal() {
        LocalDate reportDate = LocalDate.of(2026, 8, 12);
        LingxingProductPerformanceDaily known = marketplaceFact(
                "B000000001", "UK", 1, "10.00", reportDate);
        known.setDeveloperNames("夏浩宇");
        known.setPrincipalNames("阳姣");
        LingxingProductPerformanceDaily unknown = marketplaceFact(
                "B000000002", "UK", 2, "20.00", reportDate);
        unknown.setDeveloperNames("未登记开发");
        unknown.setPrincipalNames("未登记运营");

        LingxingFinanceDailyReportService.ComputedReport report = service.computeReport(
                List.of(known, unknown), Map.of(), Map.of(), Map.of(), java.util.Set.of(), reportDate,
                LingxingFinanceDailyReportService.CalculationProfile.PRODUCTION_GBP, "ALL", "GBP",
                List.of("夏浩宇"), List.of("阳姣"));

        assertThat(totalRow(report.rows()).metrics().get("销量")).isEqualByComparingTo("3");
        assertThat(report.rows().stream().filter(r -> "开发".equals(r.dimension())))
                .extracting(FinanceDailyReportRow::dimensionValue)
                .containsExactly("夏浩宇");
        assertThat(report.rows().stream().filter(r -> "运营".equals(r.dimension())))
                .extracting(FinanceDailyReportRow::dimensionValue)
                .containsExactly("阳姣");
    }

    @Test
    void recalculationUsesOnlyDailyMetadataInsteadOfPriorSnapshotOrUnifiedFallback() {
        LocalDate reportDate = LocalDate.of(2026, 8, 12);
        LingxingProductPerformanceDaily fact = marketplaceFact(
                "B000000001", "UK", 0, "0.00", reportDate);
        fact.setSyncedAt(reportDate.plusDays(8).atStartOfDay());
        fact.setTagNames("\u6b27\u6d32\u7cbe\u94fa2025\u5b63\u8282\u6027\u65ad\u8d27");
        fact.setPrincipalNames("\u9633\u59e3");
        fact.setDeveloperNames("\u5218\u6dfc");

        FinanceStatusSnapshotRow prior = new FinanceStatusSnapshotRow();
        prior.setTagNames("\u6b27\u6d32\u7cbe\u94fa2025\u6dd8\u6c70");
        prior.setProductCreateDate(LocalDate.of(2026, 8, 13));
        prior.setPrincipalNames("\u5f20\u594b\u594b");
        prior.setDeveloperNames("\u9648\u6768");

        LingxingProductUnified unified = new LingxingProductUnified();
        unified.setAsin(fact.getAsin());
        unified.setListingTags("\u6b27\u6d32\u7cbe\u94fa2025\u6dd8\u6c70");
        unified.setPrincipal("\u5f20\u594b\u594b");
        unified.setDeveloper("\u9648\u6768");

        LingxingFinanceDailyReportService.ComputedReport report = service.computeReport(
                List.of(fact), Map.of(fact.getAsin(), prior), Map.of(fact.getAsin(), unified), Map.of(),
                java.util.Set.of(), reportDate,
                LingxingFinanceDailyReportService.CalculationProfile.PRODUCTION_GBP, "ALL", "GBP",
                TEST_DEVELOPERS, TEST_OPERATORS);

        FinanceDailyReportRow total = totalRow(report.rows());
        assertThat(total.metrics().get("\u6dd8\u6c70SKU")).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(total.metrics().get("\u5b63\u8282\u6027SKU")).isEqualByComparingTo(BigDecimal.ONE);
        assertThat(total.metrics().get("SKU\u603b\u6570\u91cf")).isEqualByComparingTo(BigDecimal.ONE);
        assertThat(report.rows().stream().filter(r -> "\u8fd0\u8425".equals(r.dimension())))
                .extracting(FinanceDailyReportRow::dimensionValue).containsExactly("\u9633\u59e3");
        assertThat(report.rows().stream().filter(r -> "\u5f00\u53d1".equals(r.dimension())))
                .extracting(FinanceDailyReportRow::dimensionValue).containsExactly("\u5218\u6dfc");
        assertThat(report.statusRows()).singleElement()
                .extracting(FinanceStatusSnapshotRow::getSourceType).isEqualTo("DAILY_FACT");
    }

    @Test
    void legacyCaseCombinesUkAndDeAndKeepsCaseCurrencyAndDynamicStructure() {
        LocalDate reportDate = LocalDate.of(2026, 8, 1);
        LingxingProductPerformanceDaily uk = marketplaceFact("B000000001", "UK", 1, "10.00", reportDate);
        uk.setPrincipalNames("阳姣");
        LingxingProductPerformanceDaily de = marketplaceFact("B000000002", "DE", 2, "20.00", reportDate);
        de.setPrincipalNames("张奋奋");

        LingxingFinanceDailyReportService.ComputedReport report = service.computeLegacyCaseReport(
                List.of(uk, de), Map.of(), Map.of(), java.util.Set.of(), reportDate);

        FinanceDailyReportRow total = totalRow(report.rows());
        assertThat(total.marketplace()).isEqualTo("ALL");
        assertThat(total.currencyCode()).isEqualTo("GBP");
        assertThat(total.metrics().get("销量")).isEqualByComparingTo("3");
        assertThat(total.metrics().get("销售额")).isEqualByComparingTo("30.00");
        assertThat(report.rows().stream().filter(r -> "运营".equals(r.dimension())))
                .extracting(FinanceDailyReportRow::dimensionValue)
                .containsExactly("阳姣", "张奋奋");
        assertThat(report.rows()).noneMatch(r -> "开发".equals(r.dimension()));
    }

    @Test
    void listingTimeCutoffUsesUnifiedListingDateAheadOfListingOpenDate() {
        LocalDate reportDate = LocalDate.of(2026, 8, 12);
        LingxingProductPerformanceDaily fact = marketplaceFact("B000000001", "UK", 1, "10.00", reportDate);
        fact.setProductCreateTime("2026-01-01");
        LingxingProductUnified unified = new LingxingProductUnified();
        unified.setAsin(fact.getAsin());
        unified.setListingDate(LocalDate.of(2026, 6, 15));

        LingxingFinanceDailyReportService.ComputedReport report = service.computeReport(
                List.of(fact), Map.of(), Map.of(fact.getAsin(), unified),
                Map.of(fact.getAsin(), LocalDate.of(2026, 1, 1)),
                java.util.Set.of(), reportDate,
                LingxingFinanceDailyReportService.CalculationProfile.PRODUCTION_GBP, "ALL", "GBP",
                TEST_DEVELOPERS, TEST_OPERATORS);

        assertThat(listingTimeSku(report.rows(), "5月以前上架")).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(listingTimeSku(report.rows(), "5月及以后上架")).isEqualByComparingTo(BigDecimal.ONE);
    }

    @Test
    void listingTimeCutoffFallsBackToListingOpenDateForNewAsin() {
        LocalDate reportDate = LocalDate.of(2026, 8, 12);
        LingxingProductPerformanceDaily fact = marketplaceFact("B000000002", "UK", 1, "10.00", reportDate);
        fact.setProductCreateTime(null);

        LingxingFinanceDailyReportService.ComputedReport report = service.computeReport(
                List.of(fact), Map.of(), Map.of(),
                Map.of(fact.getAsin(), LocalDate.of(2026, 4, 20)),
                java.util.Set.of(), reportDate,
                LingxingFinanceDailyReportService.CalculationProfile.PRODUCTION_GBP, "ALL", "GBP",
                TEST_DEVELOPERS, TEST_OPERATORS);

        assertThat(listingTimeSku(report.rows(), "5月以前上架")).isEqualByComparingTo(BigDecimal.ONE);
        assertThat(listingTimeSku(report.rows(), "5月及以后上架")).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void consolidationRetainsMarketplace() {
        LocalDate reportDate = LocalDate.of(2026, 8, 12);
        LingxingProductPerformanceDaily first = marketplaceFact(
                "B000000001", "UK", 1, "10.00", reportDate);
        LingxingProductPerformanceDaily second = marketplaceFact(
                "B000000001", "UK", 2, "20.00", reportDate);

        List<LingxingProductPerformanceDaily> consolidated =
                service.consolidateFactsByAsin(List.of(first, second));

        assertThat(consolidated).singleElement()
                .extracting(LingxingProductPerformanceDaily::getMarketplace)
                .isEqualTo("UK");
    }

    private LingxingProductPerformanceDaily marketplaceFact(
            String asin, String marketplace, int volume, String amount, LocalDate reportDate) {
        LingxingProductPerformanceDaily fact = new LingxingProductPerformanceDaily();
        fact.setAsin(asin);
        fact.setMarketplace(marketplace);
        fact.setDataDate(reportDate);
        fact.setProductCreateTime("2026-01-01");
        fact.setAfnFulfillableQuantity(1);
        fact.setVolume(volume);
        fact.setAmount(new BigDecimal(amount));
        return fact;
    }

    @Test
    void pulledFactsWithTeamTagsKeepsOnlyTeamListingTags() {
        LingxingProductPerformanceDaily team = new LingxingProductPerformanceDaily();
        team.setAsin("B0TEAM");
        team.setTagNames("欧洲精铺2025,绿标");
        LingxingProductPerformanceDaily other = new LingxingProductPerformanceDaily();
        other.setAsin("B0OTHER");
        other.setTagNames("普通产品");

        assertThat(service.pulledFactsWithTeamTags(List.of(team, other)))
                .extracting(LingxingProductPerformanceDaily::getAsin)
                .containsExactly("B0TEAM");
    }

    private FinanceDailyReportRow totalRow(List<FinanceDailyReportRow> rows) {
        return rows.stream().filter(row -> "总".equals(row.dimension())).findFirst().orElseThrow();
    }

    private BigDecimal listingTimeSku(List<FinanceDailyReportRow> rows, String value) {
        return rows.stream()
                .filter(row -> "上架时间".equals(row.dimension()) && value.equals(row.dimensionValue()))
                .findFirst()
                .map(row -> row.metrics().get("SKU总数量"))
                .orElse(BigDecimal.ZERO);
    }
}
