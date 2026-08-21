package com.sjzm.product.modules.automation.job;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AutomationJobRegistryTest {

    @Test
    void registersJobsByNormalizedCode() {
        AutomationJobRegistry registry = new AutomationJobRegistry(List.of(job(" logistics_sync ")));

        assertThat(registry.find("LOGISTICS_SYNC")).isPresent();
        assertThat(registry.list()).extracting(AutomationJobDescriptor::code)
                .containsExactly("LOGISTICS_SYNC");
    }

    @Test
    void rejectsDuplicateCodes() {
        assertThatThrownBy(() -> new AutomationJobRegistry(List.of(job("A"), job("a"))))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Duplicate");
    }

    private AutomationJob job(String code) {
        return new AutomationJob() {
            @Override public String code() { return code; }
            @Override public String name() { return "test"; }
            @Override public AutomationJobResult execute(AutomationExecutionContext context) {
                return AutomationJobResult.empty();
            }
        };
    }
}
