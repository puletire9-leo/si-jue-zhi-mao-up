package com.sjzm.product.modules.lingxing.requestcenter.service;

import com.sjzm.product.modules.automation.service.AutomationCenterService;
import com.sjzm.product.modules.lingxing.requestcenter.handler.LingxingTaskHandlerRegistry;
import com.sjzm.product.modules.lingxing.requestcenter.mapper.LingxingAutomationRequestRegistryMapper;
import com.sjzm.product.modules.lingxing.requestcenter.mapper.LingxingRequestTaskMapper;
import com.sjzm.product.modules.lingxing.requestcenter.service.impl.LingxingRequestCenterServiceImpl;
import com.sjzm.product.modules.lingxing.service.LingxingClient;
import com.sjzm.product.modules.lingxing.service.LingxingConfigService;
import org.junit.jupiter.api.Test;

import java.util.concurrent.Executor;

import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class LingxingRequestCenterRecoveryTest {

    @Test
    void recoverClosesStaleAutomationRunsBeforeResettingQueueTasks() {
        LingxingRequestTaskMapper taskMapper = mock(LingxingRequestTaskMapper.class);
        AutomationCenterService automationCenterService = mock(AutomationCenterService.class);
        when(taskMapper.resetStaleRunningToPending()).thenReturn(0);
        when(taskMapper.selectOldestPending()).thenReturn(null);

        LingxingRequestCenterServiceImpl service = new LingxingRequestCenterServiceImpl(
                taskMapper,
                mock(LingxingAutomationRequestRegistryMapper.class),
                mock(LingxingTaskHandlerRegistry.class),
                mock(LingxingClient.class),
                mock(LingxingConfigService.class),
                automationCenterService,
                mock(Executor.class));

        service.recoverQueuedTasks();

        var order = inOrder(automationCenterService, taskMapper);
        order.verify(automationCenterService).interruptStaleLingxingRequestRuns();
        order.verify(taskMapper).resetStaleRunningToPending();
    }
}
