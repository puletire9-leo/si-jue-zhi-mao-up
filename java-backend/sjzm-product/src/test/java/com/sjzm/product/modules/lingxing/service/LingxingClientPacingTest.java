package com.sjzm.product.modules.lingxing.service;

import com.sjzm.product.modules.lingxing.config.LingxingConfig;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class LingxingClientPacingTest {

    private final LingxingClient client = new LingxingClient(
            mock(LingxingConfig.class), mock(LingxingConfigService.class));

    @Test
    void usesTenSecondIntervalForProductPerformanceApi() {
        assertThat(client.requestIntervalMs("/bd/productPerformance/openApi/asinList"))
                .isEqualTo(10_000L);
    }

    @Test
    void usesHalfSecondIntervalForOtherApis() {
        assertThat(client.requestIntervalMs("/erp/sc/data/mws/listing"))
                .isEqualTo(500L);
        assertThat(client.requestIntervalMs(null)).isEqualTo(500L);
    }
}
