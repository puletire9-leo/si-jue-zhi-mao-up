package com.sjzm.product.service;

import com.sjzm.product.entity.CompetitorProduct;
import com.sjzm.product.mapper.CompetitorProductMapper;
import com.sjzm.product.service.impl.ElementDiscoveryServiceImpl;
import com.sjzm.product.service.impl.ProductTitleParsingServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ElementDiscoveryServiceTest {

    @Mock
    CompetitorProductMapper competitorProductMapper;

    @Test
    void previewPath2_usesLatestMonthAndAggregatesElements() {
        when(competitorProductMapper.selectLatestMonth("UK")).thenReturn("202606");
        when(competitorProductMapper.selectList(any())).thenReturn(List.of(
                product("UK", "202606", "A1", "Capybara Drawstring Bag for Kids", "Toys:Drawstring Bags", 32, 1200, "6.99"),
                product("UK", "202606", "A2", "Capybara Water Bottle with Lid", "Sports:Water Bottles", 18, 2200, "8.99"),
                product("UK", "202606", "A3", "Butterfly Mug Gift for Women", "Home:Mugs", 15, 3100, "7.99"),
                product("UK", "202606", "A4", "Floral Home Decor for Girls Bedroom", "Home:Decor", 40, 1800, "9.99"),
                product("UK", "202606", "A5", "4 Pcs Car Tyre Valve Dust Caps for Land Rover Discovery Range Rover Sport Defender, Alloy Tyre Valve Stem Covers, Universal Dust Caps for Car Tires", "Automotive:Valve Caps", 25, 900, "12.99"),
                product("UK", "202606", "A6", "Funko POP! Games: Marvel Rivals - Psylocke - Collectable Vinyl Figure - Gift Idea - Official Merchandise - Toys For Kids & Adults - Model Figure for Collectors and Display", "Toys:Chibi Characters", 19, 1500, "13.99")
        ));

        ElementDiscoveryService service = new ElementDiscoveryServiceImpl(
                competitorProductMapper,
                new ProductTitleParsingServiceImpl()
        );

        Map<String, Object> result = service.previewPath2("UK", null, 200, 10, 1, 0);

        assertThat(result.get("month")).isEqualTo("202606");
        assertThat(result.get("scannedProducts")).isEqualTo(6);
        assertThat(result.get("parsedProducts")).isEqualTo(3);
        assertThat(result.get("filteredStandardProducts")).isEqualTo(2);

        @SuppressWarnings("unchecked")
        Map<String, Integer> filteredByReason = (Map<String, Integer>) result.get("filteredByReason");
        assertThat(filteredByReason)
                .containsEntry("fitment_or_hardware", 1)
                .containsEntry("official_merch_or_collectible", 1);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> filteredSamples = (List<Map<String, Object>>) result.get("filteredSamples");
        assertThat(filteredSamples)
                .extracting(row -> row.get("filterReason"))
                .contains("fitment_or_hardware", "official_merch_or_collectible");

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> topElements = (List<Map<String, Object>>) result.get("topElements");
        assertThat(topElements).hasSize(2);
        assertThat(topElements)
                .extracting(row -> row.get("element"))
                .doesNotContain("Tyre Valve Dust", "Rivals Psylocke Collectable");

        Map<String, Object> capybara = topElements.get(0);
        assertThat(capybara.get("element")).isEqualTo("Capybara");
        assertThat(capybara.get("productCount")).isEqualTo(2);
        assertThat(capybara.get("totalUnits")).isEqualTo(50);
        assertThat(capybara.get("carrierCount")).isEqualTo(2);
        assertThat(capybara.get("bestBsr")).isEqualTo(1200);
    }

    @Test
    void previewCarrierMatch_auditsCarrierPrecisionWithDocumentBootstrap() {
        when(competitorProductMapper.selectLatestMonth("UK")).thenReturn("202606");
        when(competitorProductMapper.selectList(any())).thenReturn(List.of(
                product("UK", "202606", "A1", "Capybara Drawstring Bag for Kids", "Toys:Drawstring Bags", 32, 1200, "6.99"),
                product("UK", "202606", "A2", "Funko POP! Games: Marvel Rivals - Psylocke - Collectable Vinyl Figure - Gift Idea - Official Merchandise - Toys For Kids & Adults - Model Figure for Collectors and Display", "Toys:Figures", 19, 1500, "13.99"),
                product("UK", "202606", "A3", "2026 Football World Cup Garden Banner Flag 200x60cm, Large Garden Flag Decor, Multipurpose Table Cover for Sports Party, Outdoor Indoor Decoration for Fan Cave Bar", "Sports:Flags", 18, 102, "9.99"),
                product("UK", "202606", "A4", "Pink Bow Cosmetic Bag for Women, Cute Makeup Bag Gift", "Fashion:Cosmetic Bags", 25, 2400, "7.99"),
                product("UK", "202606", "A5", "Football Backdrop Party Decoration, Large Photo Backdrop for Sports Event", "Party:Backdrops", 14, 1800, "8.99")
        ));

        ElementDiscoveryService service = new ElementDiscoveryServiceImpl(
                competitorProductMapper,
                new ProductTitleParsingServiceImpl()
        );

        Map<String, Object> result = service.previewCarrierMatch("UK", null, 200, 10, 2, null);

        assertThat(result.get("month")).isEqualTo("202606");
        assertThat(result.get("carrierSource")).isEqualTo("document_bootstrap");
        assertThat(result.get("scannedProducts")).isEqualTo(5);
        assertThat(result.get("matchedProducts")).isEqualTo(5);
        assertThat(result.get("keptNonStandardProducts")).isEqualTo(3);
        assertThat(result.get("filteredStandardProducts")).isEqualTo(2);
        assertThat(result.get("matchedCarrierCount")).isEqualTo(5);
        assertThat(result.get("precisionProxy")).isEqualTo(new BigDecimal("0.6000"));
        assertThat((Integer) result.get("supportedCarrierCount")).isGreaterThan(40);

        @SuppressWarnings("unchecked")
        List<String> supportedCarriers = (List<String>) result.get("supportedCarriers");
        assertThat(supportedCarriers).contains("Backdrop", "Clear Bag", "Garden Flag");

        @SuppressWarnings("unchecked")
        Map<String, Integer> filteredByReason = (Map<String, Integer>) result.get("filteredByReason");
        assertThat(filteredByReason)
                .containsEntry("official_merch_or_collectible", 1)
                .containsEntry("poster_schedule_or_event_chart", 1);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> topCarriers = (List<Map<String, Object>>) result.get("topCarriers");
        assertThat(topCarriers)
                .extracting(row -> row.get("carrier"))
                .contains("Drawstring Bag", "Garden Flag", "Cosmetic Bag", "Figure", "Backdrop");
    }

    private CompetitorProduct product(String marketplace,
                                      String month,
                                      String asin,
                                      String title,
                                      String nodeLabelPath,
                                      Integer units,
                                      Integer bsr,
                                      String price) {
        CompetitorProduct product = new CompetitorProduct();
        product.setMarketplace(marketplace);
        product.setMonth(month);
        product.setAsin(asin);
        product.setTitle(title);
        product.setNodeLabelPath(nodeLabelPath);
        product.setUnits(units);
        product.setBsr(bsr);
        product.setPrice(new BigDecimal(price));
        return product;
    }
}
