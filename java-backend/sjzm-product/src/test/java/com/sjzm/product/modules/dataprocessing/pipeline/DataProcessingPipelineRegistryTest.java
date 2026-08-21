package com.sjzm.product.modules.dataprocessing.pipeline;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DataProcessingPipelineRegistryTest {

    @Test
    void registersPipelinesByNormalizedCode() {
        DataProcessingPipelineRegistry registry = new DataProcessingPipelineRegistry(
                List.of(pipeline(" logistics_purchase_progress ")));

        assertThat(registry.find("LOGISTICS_PURCHASE_PROGRESS")).isPresent();
        assertThat(registry.list()).extracting(DataProcessingPipelineDescriptor::code)
                .containsExactly("LOGISTICS_PURCHASE_PROGRESS");
    }

    @Test
    void rejectsDuplicateCodes() {
        assertThatThrownBy(() -> new DataProcessingPipelineRegistry(List.of(
                pipeline("A"), pipeline("a"))))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Duplicate");
    }

    private DataProcessingPipeline pipeline(String code) {
        return new DataProcessingPipeline() {
            @Override public String code() { return code; }
            @Override public String name() { return "test"; }
            @Override public DataProcessingResult execute(DataProcessingContext context) {
                return DataProcessingResult.empty();
            }
        };
    }
}
