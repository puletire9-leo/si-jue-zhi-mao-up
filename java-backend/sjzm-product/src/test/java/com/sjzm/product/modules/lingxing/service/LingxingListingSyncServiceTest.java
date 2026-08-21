package com.sjzm.product.modules.lingxing.service;

import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sjzm.product.mapper.LingxingListingMapper;
import com.sjzm.product.mapper.LingxingProductUnifiedMapper;
import com.sjzm.product.modules.lingxing.entity.LingxingListing;
import com.sjzm.product.modules.lingxing.entity.LingxingProductUnified;
import com.sjzm.product.rds.service.RdsBatchWriteService;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LingxingListingSyncServiceTest {

    @BeforeAll
    static void initializeMybatisMetadata() {
        MapperBuilderAssistant assistant = new MapperBuilderAssistant(
                new MybatisConfiguration(), "finance-listing-test");
        TableInfoHelper.initTableInfo(assistant, LingxingProductUnified.class);
        TableInfoHelper.initTableInfo(assistant, LingxingListing.class);
    }

    @Mock
    private LingxingClient client;
    @Mock
    private LingxingListingMapper listingMapper;
    @Mock
    private LingxingProductUnifiedMapper unifiedMapper;
    @Mock
    private RdsBatchWriteService rdsBatchWriteService;

    @Test
    void financeRefreshMustUpsertWithoutDeletingListingTable() throws Exception {
        LingxingProductUnified unified = new LingxingProductUnified();
        unified.setAsin("B012345678");
        when(unifiedMapper.selectList(any(Wrapper.class))).thenReturn(List.of(unified));
        when(listingMapper.selectTargetSids()).thenReturn(List.of(4145L));
        when(listingMapper.selectList(any(Wrapper.class))).thenReturn(List.of());
        when(client.post(any(), any())).thenReturn(new ObjectMapper().readTree("""
                {"code":0,"data":[{
                  "sid":4145,
                  "asin":"B012345678",
                  "seller_sku":"TEST-SKU",
                  "local_sku":"1234567",
                  "currency_code":"GBP",
                  "open_date_display":"2026-05-02 08:00:00 +00:00"
                }]}
                """));
        when(rdsBatchWriteService.saveOrUpdate(any(), anyList(), anyInt(), any())).thenReturn(1);

        LingxingListingSyncService service = new LingxingListingSyncService(
                client, listingMapper, unifiedMapper, rdsBatchWriteService);
        Map<String, Object> result = service.refreshTargetListings();

        assertFalse((Boolean) result.get("truncated"));
        assertEquals("UPSERT", result.get("mode"));
        assertEquals(1, result.get("kept"));
        assertEquals(1, result.get("written"));
        verify(rdsBatchWriteService, never()).executeOne(any(), any());
        verify(rdsBatchWriteService).saveOrUpdate(any(), anyList(), anyInt(), any());
    }
}
