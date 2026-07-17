package com.sjzm.product.modules.bazhuayu.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sjzm.product.modules.bazhuayu.entity.BazhuayuTaskMapping;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class BazhuayuCloudStatsServiceTest {

    @Test
    void refreshAllUsesOneBatchStatusRequest() throws Exception {
        BazhuayuConfigService configService = mock(BazhuayuConfigService.class);
        BazhuayuClient client = mock(BazhuayuClient.class);
        BazhuayuTaskMapping first = entry("US", "task-1");
        BazhuayuTaskMapping second = entry("UK", "task-2");
        when(configService.listTaskEntries()).thenReturn(List.of(first, second));

        ObjectMapper mapper = new ObjectMapper();
        when(client.getTaskStatusesV2(anyCollection())).thenReturn(Map.of(
                "task-1", mapper.readTree("{\"taskId\":\"task-1\",\"status\":\"Finished\",\"currentTotalExtractCount\":10,\"startExecuteTime\":\"2026-07-15T16:43:55.243\",\"endExecuteTime\":\"2026-07-15T16:46:50.700\"}"),
                "task-2", mapper.readTree("{\"taskId\":\"task-2\",\"status\":\"Running\",\"currentTotalExtractCount\":20}")
        ));

        BazhuayuCloudStatsService service = new BazhuayuCloudStatsService(configService, client);

        assertThat(service.refreshAll()).isEqualTo(2);
        assertThat(service.getByTaskId("task-1").getCloudCount()).isEqualTo(10);
        assertThat(service.getByTaskId("task-1").getLatestBatchNo()).isEqualTo("20260715-164355");
        assertThat(service.getByTaskId("task-1").getLatestBatchCount()).isEqualTo(10);
        assertThat(service.getByTaskId("task-1").getLatestBatchStartTime())
                .isEqualTo(java.time.LocalDateTime.parse("2026-07-15T16:43:55.243"));
        assertThat(service.getByTaskId("task-2").getCloudCount()).isEqualTo(20);
        verify(client).getTaskStatusesV2(anyCollection());
        verify(client, never()).getTaskStatusV2("task-1");
        verify(client, never()).getTaskStatusV2("task-2");
    }

    @Test
    void refreshAllTreatsMissingCloudHistoryAsEmptyStatus() {
        BazhuayuConfigService configService = mock(BazhuayuConfigService.class);
        BazhuayuClient client = mock(BazhuayuClient.class);
        BazhuayuTaskMapping entry = entry("US", "task-without-history");
        when(configService.listTaskEntries()).thenReturn(List.of(entry));
        when(client.getTaskStatusesV2(anyCollection())).thenReturn(Map.of(
                "task-without-history", new ObjectMapper().createObjectNode()));

        BazhuayuCloudStatsService service = new BazhuayuCloudStatsService(configService, client);

        assertThat(service.refreshAll()).isEqualTo(1);
        assertThat(service.getByTaskId("task-without-history").getCloudCount()).isZero();
        assertThat(service.getByTaskId("task-without-history").getLastError()).isNull();
    }

    private BazhuayuTaskMapping entry(String marketplace, String taskId) {
        BazhuayuTaskMapping entry = new BazhuayuTaskMapping();
        entry.setFunctionKey("bangdan");
        entry.setMarketplace(marketplace);
        entry.setTaskId(taskId);
        return entry;
    }
}
