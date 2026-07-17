package com.sjzm.product.modules.shopcollection.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.sjzm.product.modules.requestcenter.gateway.SellerspriteExecutionGateway;
import com.sjzm.product.modules.requestcenter.gateway.model.SellerspriteExecutionResult;
import com.sjzm.product.modules.shopcollection.mapper.ShopProductMapper;
import com.sjzm.product.service.ProductFeatureProcessor;
import com.sjzm.product.util.WeekTagUtil;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ShopProductSyncServiceTest {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Test
    void stopsAfterTenRequestsAndReturnsPartialResult() {
        SellerspriteExecutionGateway gateway = mock(SellerspriteExecutionGateway.class);
        ShopProductMapper mapper = mock(ShopProductMapper.class);
        WeekTagUtil weekTagUtil = mock(WeekTagUtil.class);
        ProductFeatureProcessor featureProcessor = mock(ProductFeatureProcessor.class);
        when(weekTagUtil.currentWeekTag()).thenReturn("2026-W29");
        when(mapper.upsert(any())).thenReturn(1);
        when(gateway.execute(any())).thenReturn(new SellerspriteExecutionResult(
                pageWithOneHundredItems(2000), true, true, 1));

        ShopProductSyncService service = new ShopProductSyncService(
                gateway, mapper, weekTagUtil, featureProcessor);
        Map<String, Object> result = service.syncBySellerName(
                "Large Store", "UK", "test", null, "RUN_TEST", "2026-W29");

        assertEquals(10, result.get("apiCalls"));
        assertEquals(1000, result.get("fetchedCount"));
        assertEquals(1000, result.get("remainingCount"));
        assertTrue(Boolean.TRUE.equals(result.get("truncated")));
        verify(gateway, times(10)).execute(any());
    }

    private static ObjectNode pageWithOneHundredItems(int total) {
        ObjectNode data = OBJECT_MAPPER.createObjectNode();
        data.put("total", total);
        ArrayNode items = data.putArray("items");
        for (int i = 0; i < 100; i++) {
            ObjectNode item = items.addObject();
            item.put("asin", "B0TEST" + i);
            item.put("title", "Test product " + i);
            item.put("sellerName", "Large Store");
        }
        return data;
    }
}
