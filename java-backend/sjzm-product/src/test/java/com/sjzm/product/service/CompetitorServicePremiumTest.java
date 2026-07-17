package com.sjzm.product.service;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sjzm.product.dto.CompetitorLookupRequest;
import com.sjzm.product.dto.CompetitorQueryRequest;
import com.sjzm.product.entity.CompetitorProduct;
import com.sjzm.product.mapper.CompetitorProductMapper;
import com.sjzm.product.mapper.CompetitorSubcategoryMapper;
import com.sjzm.product.mapper.ShopMapper;
import com.sjzm.product.mapper.SkipAsinMapper;
import com.sjzm.product.modules.bazhuayu.mapper.PremiumProductMapper;
import org.junit.jupiter.api.Test;
import org.apache.ibatis.builder.MapperBuilderAssistant;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import org.mockito.ArgumentCaptor;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class CompetitorServicePremiumTest {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private CompetitorService service(PremiumProductMapper premiumMapper) {
        return new CompetitorService(
                mock(SellerspriteApiService.class),
                mock(CompetitorProductMapper.class),
                mock(CompetitorSubcategoryMapper.class),
                mock(CompetitorFilterService.class),
                mock(SkipAsinMapper.class),
                mock(ShopMapper.class),
                premiumMapper);
    }

    @Test
    void premiumLookupReportsRequestedAsinsMissingFromSellerSpriteResponse() throws Exception {
        PremiumProductMapper premiumMapper = mock(PremiumProductMapper.class);
        CompetitorService service = service(premiumMapper);

        CompetitorLookupRequest request = new CompetitorLookupRequest();
        request.setMarketplace("DE");
        request.setAsins(List.of("B0RETURNED1", "B0MISSING01"));
        request.setSize(100);

        JsonNode response = OBJECT_MAPPER.readTree("""
                {
                  "total": 1,
                  "items": [
                    {
                      "asin": "B0RETURNED1",
                      "title": "Returned product",
                      "imageUrl": "https://example.com/product.jpg",
                      "price": 12.99,
                      "units": 8,
                      "bsr": 1200
                    }
                  ]
                }
                """);

        Map<String, Object> result = service.doPremiumLookupAndSave(
                request, "202607", LocalDateTime.now(), 8L, "task-de",
                "德国精品", "2026-W29", "REQ_TEST", ignored -> response);

        assertThat(result.get("total")).isEqualTo(2);
        assertThat(result.get("fetchedCount")).isEqualTo(1);
        assertThat(result.get("writtenCount")).isEqualTo(1);
        assertThat(result.get("failedCount")).isEqualTo(1);
        assertThat(result.get("missingAsins")).isEqualTo(List.of("B0MISSING01"));
        assertThat(result.get("warning")).asString().contains("未返回 1 个 ASIN");
        verify(premiumMapper).insertOnDuplicateKeyUpdate(any());
    }

    @Test
    @SuppressWarnings({"rawtypes", "unchecked"})
    void premiumListingDateSortUsesAvailableDateInsteadOfFallingBackToUnits() {
        TableInfoHelper.initTableInfo(
                new MapperBuilderAssistant(new MybatisConfiguration(), "test"),
                CompetitorProduct.class);
        PremiumProductMapper premiumMapper = mock(PremiumProductMapper.class);
        when(premiumMapper.selectCountForSelection(any())).thenReturn(0L);
        when(premiumMapper.selectListForSelection(any())).thenReturn(List.of());
        CompetitorService service = service(premiumMapper);

        CompetitorQueryRequest request = new CompetitorQueryRequest();
        request.setMarketplace("DE");
        request.setSortBy("listingDate");
        request.setSortOrder("desc");
        request.setPage(1);
        request.setSize(20);

        service.queryPremiumFromDb(request);

        ArgumentCaptor<Wrapper<CompetitorProduct>> captor =
                (ArgumentCaptor) ArgumentCaptor.forClass(Wrapper.class);
        verify(premiumMapper).selectListForSelection(captor.capture());
        String sqlSegment = captor.getValue().getSqlSegment();
        assertThat(sqlSegment).contains("available_date IS NULL ASC");
        assertThat(sqlSegment).contains("available_date DESC");
        assertThat(sqlSegment).contains("asin ASC");
        assertThat(sqlSegment).doesNotContain("units DESC");
    }
}
