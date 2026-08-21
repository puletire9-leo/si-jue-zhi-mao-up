package com.sjzm.product.modules.lingxing.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.sjzm.product.mapper.LingxingProductPerformanceMapper;
import com.sjzm.product.rds.service.RdsBatchWriteService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class LingxingProductPerformanceSyncServiceTest {

    private final LingxingClient client = mock(LingxingClient.class);
    private final LingxingProductPerformanceMapper mapper = mock(LingxingProductPerformanceMapper.class);
    private final RdsBatchWriteService rdsWriteCenter = mock(RdsBatchWriteService.class);
    private final LingxingProductPerformanceSyncService service =
            new LingxingProductPerformanceSyncService(client, mapper, rdsWriteCenter);
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void defaultsProductPerformanceRequestToGbp() {
        ObjectNode response = objectMapper.createObjectNode();
        response.putObject("data").putArray("list");
        when(client.post(anyString(), org.mockito.ArgumentMatchers.any())).thenReturn(response);

        Map<String, Object> result = service.sync(
                List.of(101L), "2026-08-10", "2026-08-16", "msku", null);

        ArgumentCaptor<ObjectNode> body = ArgumentCaptor.forClass(ObjectNode.class);
        verify(client).post(anyString(), body.capture());
        assertEquals("GBP", body.getValue().path("currency_code").asText());
        assertEquals("GBP", result.get("currencyCode"));
    }

    @Test
    void rejectsNonGbpRequestBeforeCallingLingxing() {
        IllegalArgumentException error = assertThrows(IllegalArgumentException.class, () ->
                service.sync(List.of(101L), "2026-08-10", "2026-08-16", "msku", "EUR"));

        assertEquals("领星产品表现统一使用 GBP，拒绝币种: EUR", error.getMessage());
        verify(client, never()).post(anyString(), org.mockito.ArgumentMatchers.any());
    }
}
