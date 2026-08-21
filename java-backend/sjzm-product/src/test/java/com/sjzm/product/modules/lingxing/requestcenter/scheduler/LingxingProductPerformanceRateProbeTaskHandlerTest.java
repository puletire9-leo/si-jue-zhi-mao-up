package com.sjzm.product.modules.lingxing.requestcenter.scheduler;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class LingxingProductPerformanceRateProbeTaskHandlerTest {

    @Test
    void rateLimitRaisesNextIntervalByTwoSeconds() {
        assertThat(LingxingProductPerformanceRateProbeTaskHandler
                .recommendInterval(5_000L, 2, 1)).isEqualTo(7_000L);
    }

    @Test
    void stableRunCarefullyReducesIntervalButNeverBelowFiveSeconds() {
        assertThat(LingxingProductPerformanceRateProbeTaskHandler
                .recommendInterval(10_000L, 8, 0)).isEqualTo(9_500L);
        assertThat(LingxingProductPerformanceRateProbeTaskHandler
                .recommendInterval(5_000L, 20, 0)).isEqualTo(5_000L);
    }

    @Test
    void shortRunKeepsCurrentInterval() {
        assertThat(LingxingProductPerformanceRateProbeTaskHandler
                .recommendInterval(8_000L, 3, 0)).isEqualTo(8_000L);
    }
}
