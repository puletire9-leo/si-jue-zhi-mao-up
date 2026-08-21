package com.sjzm.product.modules.automation.job;

import com.sjzm.product.modules.automation.config.FinanceDailyReportConfig;
import com.sjzm.product.modules.automation.service.AutomationBindingService;
import com.sjzm.product.modules.feishu.service.FeishuClient;
import com.sjzm.product.modules.lingxing.dto.FinanceDailyReportResult;
import com.sjzm.product.modules.lingxing.service.LingxingFinanceDailyReportService;
import com.sjzm.product.modules.lingxing.service.LingxingListingSyncService;
import com.sjzm.product.modules.roster.service.PersonRosterService;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class FinanceDailyReportJobListingRefreshTest {

    @Test
    void historicalRerunCanReuseRdsWithoutRefreshingListing() {
        LingxingFinanceDailyReportService financeService = mock(LingxingFinanceDailyReportService.class);
        LingxingListingSyncService listingService = mock(LingxingListingSyncService.class);
        LocalDate reportDate = LocalDate.of(2026, 8, 12);
        when(financeService.run(reportDate, false, false, false, false))
                .thenReturn(emptyResult(reportDate));

        AutomationJobResult result = job(financeService, listingService).execute(context(Map.of(
                "reportDate", reportDate.toString(),
                "pullFromLingxing", false,
                "refreshListing", false,
                "persistFacts", false,
                "persistStatusSnapshot", false,
                "publishToFeishu", false)));

        verify(listingService, never()).refreshTargetListings();
        verify(financeService).run(reportDate, false, false, false, false);
        assertEquals(false, result.details().get("refreshListing"));
    }

    @Test
    void liveRunRefreshesListingBeforeFinanceProcessingByDefault() {
        LingxingFinanceDailyReportService financeService = mock(LingxingFinanceDailyReportService.class);
        LingxingListingSyncService listingService = mock(LingxingListingSyncService.class);
        LocalDate reportDate = LocalDate.of(2026, 8, 20);
        when(listingService.refreshTargetListings()).thenReturn(Map.of("mode", "UPSERT"));
        when(financeService.run(reportDate, true, true, false, false))
                .thenReturn(emptyResult(reportDate));

        AutomationJobResult result = job(financeService, listingService).execute(context(Map.of(
                "reportDate", reportDate.toString(),
                "pullFromLingxing", true,
                "publishToFeishu", false)));

        verify(listingService).refreshTargetListings();
        verify(financeService).run(reportDate, true, true, false, false);
        assertEquals(true, result.details().get("refreshListing"));
        assertEquals(Map.of("mode", "UPSERT"), result.details().get("listingRefresh"));
    }

    private FinanceDailyReportJob job(LingxingFinanceDailyReportService financeService,
                                      LingxingListingSyncService listingService) {
        return new FinanceDailyReportJob(
                financeService, listingService, mock(FeishuClient.class),
                mock(AutomationBindingService.class), new FinanceDailyReportConfig(),
                mock(PersonRosterService.class));
    }

    private AutomationExecutionContext context(Map<String, Object> parameters) {
        return new AutomationExecutionContext(1L, "test", "MANUAL", "codex", "test", parameters);
    }

    private FinanceDailyReportResult emptyResult(LocalDate reportDate) {
        FinanceDailyReportResult result = new FinanceDailyReportResult();
        result.setReportDate(reportDate);
        result.setRows(List.of());
        result.setStageDurationsMs(Map.of());
        return result;
    }
}
