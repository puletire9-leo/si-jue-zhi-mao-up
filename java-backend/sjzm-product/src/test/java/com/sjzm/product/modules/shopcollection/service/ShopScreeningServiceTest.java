package com.sjzm.product.modules.shopcollection.service;

import com.sjzm.product.config.DatabaseWorkloadGate;
import com.sjzm.product.modules.shopcollection.dto.ShopScreeningQuery;
import com.sjzm.product.modules.shopcollection.dto.ShopScreeningRow;
import com.sjzm.product.modules.shopcollection.mapper.ShopScreeningMapper;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ShopScreeningServiceTest {

    @Test
    void normalizesBatchSellerNamesAndUsesLatestBatchByDefault() {
        ShopScreeningMapper mapper = mock(ShopScreeningMapper.class);
        when(mapper.selectBatchOptions("UK")).thenReturn(List.of(Map.of("batchCode", "2026-W29")));
        ShopScreeningRow row = new ShopScreeningRow();
        row.setTotalRows(1L);
        when(mapper.screen(any(), any(BigDecimal.class), any(BigDecimal.class), any(BigDecimal.class), any(Integer.class),
                any(Integer.class), any(Integer.class), any(Integer.class), any(Integer.class)))
                .thenReturn(List.of(row));

        ShopScreeningQuery query = new ShopScreeningQuery();
        query.setMarketplace("uk");
        query.setSellerNames(List.of(" PARKTION\nGAMZE HOME ", "PARKTION"));
        query.setSortBy("unsupported");
        query.setSortOrder("asc");

        new ShopScreeningService(mapper, workloadGate()).screen(query);

        assertEquals("UK", query.getMarketplace());
        assertEquals(List.of("2026-W29"), query.getBatchCodes());
        assertEquals(List.of("PARKTION", "GAMZE HOME"), query.getSellerNames());
        assertEquals("passedProductCount", query.getSortBy());
        assertEquals("ASC", query.getSortOrder());
        verify(mapper).selectBatchOptions("UK");
    }

    private DatabaseWorkloadGate workloadGate() {
        return new DatabaseWorkloadGate(2, 1, 1, 1000);
    }
}
