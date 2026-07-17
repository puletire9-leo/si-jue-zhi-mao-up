package com.sjzm.product.modules.bazhuayu.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class BazhuayuBatchSnapshotTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void buildsVisibleBatchNumberFromLatestStartTime() throws Exception {
        BazhuayuBatchSnapshot batch = BazhuayuBatchSnapshot.fromStatus(mapper.readTree("""
                {
                  "status": "Finished",
                  "currentTotalExtractCount": 1136,
                  "startExecuteTime": "2026-07-15T16:43:55.243",
                  "executingTime": "2026-07-15T16:43:57.277",
                  "endExecuteTime": "2026-07-15T16:46:50.700"
                }
                """));

        assertThat(batch.batchNo()).isEqualTo("20260715-164355");
        assertThat(batch.cloudCount()).isEqualTo(1136);
        assertThat(batch.isFinished()).isTrue();
    }

    @Test
    void rejectsImportWhenPageBatchNoLongerMatchesCloud() throws Exception {
        BazhuayuBatchSnapshot current = BazhuayuBatchSnapshot.fromStatus(mapper.readTree("""
                {
                  "status": "Finished",
                  "currentTotalExtractCount": 50,
                  "startExecuteTime": "2026-07-16T10:00:00"
                }
                """));
        BazhuayuBatchSnapshot stale = BazhuayuBatchSnapshot.expected(
                "20260715-164355", "2026-07-15T16:43:55.243", null, 1136);

        assertThatThrownBy(() -> current.assertSameBatch(stale))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("云端最新批次已变化");
    }
}
