package com.sjzm.product.modules.lingxing.service;

import com.sjzm.product.modules.lingxing.entity.LingxingProductPerformanceDaily;
import com.sjzm.product.rds.finance.mapper.FinanceRdsDailyMapper;
import com.sjzm.product.rds.finance.mapper.FinanceRdsHistoryMapper;
import com.sjzm.product.rds.finance.model.FinanceStatusSnapshotRow;
import com.sjzm.product.rds.service.RdsBatchWriteService;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class LingxingFinanceRdsBatchWriteTest {

    @Test
    void dailyFactsUseTwoHundredRowBatches() {
        FinanceRdsDailyMapper dailyMapper = mock(FinanceRdsDailyMapper.class);
        when(dailyMapper.countByDate(LocalDate.of(2026, 8, 16), null)).thenReturn(0);
        when(dailyMapper.insertBatch(anyList())).thenAnswer(invocation ->
                ((List<?>) invocation.getArgument(0)).size());
        RdsBatchWriteService rdsWriteCenter = mock(RdsBatchWriteService.class);
        when(rdsWriteCenter.executeOne(org.mockito.ArgumentMatchers.eq(FinanceRdsDailyMapper.class),
                org.mockito.ArgumentMatchers.any())).thenAnswer(invocation -> {
            Function<FinanceRdsDailyMapper, Integer> operation = invocation.getArgument(1);
            return operation.apply(dailyMapper);
        });
        LingxingFinanceDailyReportService service = new LingxingFinanceDailyReportService(
                null, null, dailyMapper, null, null, rdsWriteCenter, null);

        List<LingxingProductPerformanceDaily> rows = new ArrayList<>();
        for (int i = 0; i < 451; i++) rows.add(new LingxingProductPerformanceDaily());

        assertThat(service.storeDailyFacts(LocalDate.of(2026, 8, 16), rows)).isEqualTo(451);
        verify(dailyMapper, times(3)).insertBatch(anyList());
    }

    @Test
    void statusSnapshotsUseFiveHundredRowBatches() {
        FinanceRdsHistoryMapper historyMapper = mock(FinanceRdsHistoryMapper.class);
        when(historyMapper.countStatusSnapshotByDate(LocalDate.of(2026, 8, 16), "ALL")).thenReturn(0);
        when(historyMapper.insertStatusSnapshotBatch(anyList())).thenAnswer(invocation ->
                ((List<?>) invocation.getArgument(0)).size());
        RdsBatchWriteService rdsWriteCenter = mock(RdsBatchWriteService.class);
        when(rdsWriteCenter.executeOne(org.mockito.ArgumentMatchers.eq(FinanceRdsHistoryMapper.class),
                org.mockito.ArgumentMatchers.any())).thenAnswer(invocation -> {
            Function<FinanceRdsHistoryMapper, Integer> operation = invocation.getArgument(1);
            return operation.apply(historyMapper);
        });
        LingxingFinanceDailyReportService service = new LingxingFinanceDailyReportService(
                null, null, null, historyMapper, null, rdsWriteCenter, null);

        List<FinanceStatusSnapshotRow> rows = new ArrayList<>();
        for (int i = 0; i < 1001; i++) rows.add(new FinanceStatusSnapshotRow());

        assertThat(service.storeStatusSnapshot(LocalDate.of(2026, 8, 16), "ALL", rows)).isEqualTo(1001);
        verify(historyMapper, times(3)).insertStatusSnapshotBatch(anyList());
    }
}
