package com.sjzm.product.modules.lingxing.requestcenter.scheduler;

import com.sjzm.product.modules.lingxing.requestcenter.service.LingxingRequestCenterService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class LingxingDataSyncEnqueuerTest {

    @Mock private LingxingRequestCenterService requestCenterService;
    private LingxingDataSyncEnqueuer enqueuer;

    @BeforeEach
    void setUp() {
        enqueuer = new LingxingDataSyncEnqueuer(requestCenterService);
    }

    @Test
    void disabledSchedulerDoesNotEnqueue() {
        ReflectionTestUtils.setField(enqueuer, "scheduledEnabled", false);
        enqueuer.enqueueWeeklyProductSync();
        enqueuer.enqueueDailyInventoryBatchSync();
        verify(requestCenterService, never()).enqueue(
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    void enabledSchedulerOnlyEnqueuesPersistentTasks() {
        ReflectionTestUtils.setField(enqueuer, "scheduledEnabled", true);
        enqueuer.enqueueWeeklyProductSync();
        enqueuer.enqueueDailyInventoryBatchSync();

        verify(requestCenterService).enqueue(eq(LingxingWeeklyProductSyncTaskHandler.TYPE),
                contains("startDate"), eq("lingxing-scheduler"));
        verify(requestCenterService).enqueue(eq(LingxingInventoryBatchSyncTaskHandler.TYPE),
                contains("startDate"), eq("lingxing-scheduler"));
    }
}
