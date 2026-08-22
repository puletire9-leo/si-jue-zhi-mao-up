package com.sjzm.product.modules.lingxing.requestcenter.service;

import com.sjzm.product.modules.automation.job.FinanceDailyReportJob;
import com.sjzm.product.modules.lingxing.requestcenter.scheduler.LingxingWeeklyProductSyncTaskHandler;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class UnifiedPeriodBackfillPlannerTest {

    @Test
    void plansDailyTasksBeforeWeeklyWindows() {
        List<UnifiedPeriodBackfillPlanner.Spec> specs = UnifiedPeriodBackfillPlanner.plan(
                LocalDate.of(2026, 8, 3),
                LocalDate.of(2026, 8, 16),
                LocalDate.of(2026, 8, 12),
                LocalDate.of(2026, 8, 13),
                true,
                true);

        assertThat(specs).hasSize(4);
        assertThat(specs.get(0).taskType()).isEqualTo(FinanceDailyReportJob.CODE);
        assertThat(specs.get(0).payloadJson()).contains("\"reportDate\":\"2026-08-12\"");
        assertThat(specs.get(0).payloadJson()).contains("\"refreshListing\":true");
        assertThat(specs.get(1).payloadJson()).contains("\"reportDate\":\"2026-08-13\"");
        assertThat(specs.get(1).payloadJson()).contains("\"refreshListing\":false");
        assertThat(specs.get(2).taskType()).isEqualTo(LingxingWeeklyProductSyncTaskHandler.TYPE);
        assertThat(specs.get(2).payloadJson()).isEqualTo(
                "{\"startDate\":\"2026-08-03\",\"endDate\":\"2026-08-09\"}");
        assertThat(specs.get(3).payloadJson()).isEqualTo(
                "{\"startDate\":\"2026-08-10\",\"endDate\":\"2026-08-16\"}");
    }

    @Test
    void defaultsLastCompleteSundayAndFirstMondayOfApril2025() {
        List<UnifiedPeriodBackfillPlanner.Spec> specs = UnifiedPeriodBackfillPlanner.plan(
                null, null, null, null, null, null, LocalDate.of(2026, 8, 22));

        assertThat(specs.get(0).payloadJson()).contains("\"reportDate\":\"2026-08-12\"");
        assertThat(specs.get(9).payloadJson()).contains("\"reportDate\":\"2026-08-21\"");
        assertThat(specs.get(10).payloadJson()).isEqualTo(
                "{\"startDate\":\"2025-04-07\",\"endDate\":\"2025-04-13\"}");
        assertThat(specs.get(specs.size() - 1).payloadJson()).isEqualTo(
                "{\"startDate\":\"2026-08-10\",\"endDate\":\"2026-08-16\"}");
        assertThat(specs).hasSize(10 + 71);
    }
}
