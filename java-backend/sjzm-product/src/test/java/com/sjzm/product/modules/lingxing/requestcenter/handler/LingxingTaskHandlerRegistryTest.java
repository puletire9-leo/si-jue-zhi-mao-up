package com.sjzm.product.modules.lingxing.requestcenter.handler;

import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LingxingTaskHandlerRegistryTest {

    private static LingxingTaskHandler handler(String type) {
        return new LingxingTaskHandler() {
            @Override
            public String taskType() {
                return type;
            }

            @Override
            public LingxingTaskResult execute(LingxingTaskExecutionContext context) {
                return LingxingTaskResult.success(new ObjectMapper().createObjectNode());
            }
        };
    }

    @Test
    void indexesHandlersByNormalizedType() {
        LingxingTaskHandlerRegistry registry = new LingxingTaskHandlerRegistry(
                List.of(handler("product-performance-sync"), handler("Profit_Asin_Sync")));

        assertThat(registry.knownTypes()).containsExactlyInAnyOrder("PRODUCT-PERFORMANCE-SYNC", "PROFIT_ASIN_SYNC");
        assertThat(registry.knows("product-performance-sync")).isTrue();
        assertThat(registry.knows("PROFIT_ASIN_SYNC")).isTrue();
        assertThat(registry.knows("missing")).isFalse();
        assertThat(registry.handlerFor("  Product-Performance-Sync  ")).isNotNull();
    }

    @Test
    void rejectsDuplicateTaskType() {
        assertThatThrownBy(() -> new LingxingTaskHandlerRegistry(
                List.of(handler("SYNC"), handler("sync"))))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("重复");
    }

    @Test
    void rejectsBlankTaskType() {
        assertThatThrownBy(() -> new LingxingTaskHandlerRegistry(
                List.of(handler("  "))))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("不能为空");
    }

    @Test
    void resultFactoriesBuildSuccessAndFailure() {
        ObjectNode data = new ObjectMapper().createObjectNode();
        data.put("rows", 1);

        assertThat(LingxingTaskResult.success(data).success()).isTrue();
        assertThat(LingxingTaskResult.success(data).data()).isSameAs(data);
        assertThat(LingxingTaskResult.failure("boom").success()).isFalse();
        assertThat(LingxingTaskResult.failure("boom").message()).isEqualTo("boom");
    }
}
