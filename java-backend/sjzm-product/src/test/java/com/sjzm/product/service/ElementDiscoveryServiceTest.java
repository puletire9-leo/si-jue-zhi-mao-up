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
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ElementDiscoveryServiceTest {

    @Mock
    CompetitorProductMapper competitorProductMapper;

    @Mock
    SalesBaselineService salesBaselineService;

    @Test
    void previewPath2_usesLatestMonthAndAggregatesElements() {
        when(competitorProductMapper.selectLatestMonth("UK")).thenReturn("202606");
        when(competitorProductMapper.selectCleanCandidatesForDiscovery(anyString(), anyString(), anyInt())).thenReturn(List.of(
                product("UK", "202606", "A1", "Capybara Drawstring Bag for Kids", "Toys:Drawstring Bags", 32, 1200, "6.99"),
                product("UK", "202606", "A2", "Capybara Water Bottle with Lid", "Sports:Water Bottles", 18, 2200, "8.99"),
                product("UK", "202606", "A3", "Butterfly Mug Gift for Women", "Home:Mugs", 15, 3100, "7.99"),
                product("UK", "202606", "A4", "Floral Home Decor for Girls Bedroom", "Home:Decor", 40, 1800, "9.99"),
                product("UK", "202606", "A5", "4 Pcs Car Tyre Valve Dust Caps for Land Rover Discovery Range Rover Sport Defender, Alloy Tyre Valve Stem Covers, Universal Dust Caps for Car Tires", "Automotive:Valve Caps", 25, 900, "12.99"),
                product("UK", "202606", "A6", "Funko POP! Games: Marvel Rivals - Psylocke - Collectable Vinyl Figure - Gift Idea - Official Merchandise - Toys For Kids & Adults - Model Figure for Collectors and Display", "Toys:Chibi Characters", 19, 1500, "13.99")
        ));

        ElementDiscoveryService service = new ElementDiscoveryServiceImpl(
                competitorProductMapper,
                new ProductTitleParsingServiceImpl(),
                salesBaselineService
        );

        Map<String, Object> result = service.previewPath2("UK", null, 200, 10, 1, 0);

        assertThat(result.get("month")).isEqualTo("202606");
        assertThat(result.get("scannedProducts")).isEqualTo(6);
        assertThat(result.get("parsedProducts")).isEqualTo(3);
        assertThat(result.get("filteredStandardProducts")).isEqualTo(1);

        @SuppressWarnings("unchecked")
        Map<String, Integer> filteredByReason = (Map<String, Integer>) result.get("filteredByReason");
        assertThat(filteredByReason)
                .containsEntry("official_merch_or_collectible", 1);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> filteredSamples = (List<Map<String, Object>>) result.get("filteredSamples");
        assertThat(filteredSamples)
                .extracting(row -> row.get("filterReason"))
                .containsExactly("official_merch_or_collectible");

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
        when(competitorProductMapper.selectCleanCandidatesForDiscovery(anyString(), anyString(), anyInt())).thenReturn(List.of(
                product("UK", "202606", "A1", "Capybara Drawstring Bag for Kids", "Toys:Drawstring Bags", 32, 1200, "6.99"),
                product("UK", "202606", "A2", "Funko POP! Games: Marvel Rivals - Psylocke - Collectable Vinyl Figure - Gift Idea - Official Merchandise - Toys For Kids & Adults - Model Figure for Collectors and Display", "Toys:Figures", 19, 1500, "13.99"),
                product("UK", "202606", "A3", "2026 Football World Cup Garden Banner Flag 200x60cm, Large Garden Flag Decor, Multipurpose Table Cover for Sports Party, Outdoor Indoor Decoration for Fan Cave Bar", "Sports:Flags", 18, 102, "9.99"),
                product("UK", "202606", "A4", "Pink Bow Cosmetic Bag for Women, Cute Makeup Bag Gift", "Fashion:Cosmetic Bags", 25, 2400, "7.99"),
                product("UK", "202606", "A5", "Football Backdrop Party Decoration, Large Photo Backdrop for Sports Event", "Party:Backdrops", 14, 1800, "8.99")
        ));

        ElementDiscoveryService service = new ElementDiscoveryServiceImpl(
                competitorProductMapper,
                new ProductTitleParsingServiceImpl(),
                salesBaselineService
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

    @Test
    void listManualCandidates_returnsFilteredRowsReadyForBatchExport() {
        when(competitorProductMapper.selectLatestMonth("UK")).thenReturn("202606");
        when(competitorProductMapper.selectCleanCandidatesForDiscovery(anyString(), anyString(), anyInt())).thenReturn(List.of(
                product("UK", "202606", "A1", "Capybara Drawstring Bag for Kids", "Toys:Drawstring Bags", 32, 1200, "6.99", "toys"),
                product("UK", "202606", "A2", "Pink Bow Cosmetic Bag for Women, Cute Makeup Bag Gift", "Fashion:Cosmetic Bags", 25, 2400, "7.99", "fashion"),
                product("UK", "202606", "A3", "Football Backdrop Party Decoration, Large Photo Backdrop for Sports Event", "Party:Backdrops", 14, 1800, "8.99", "sports/outdoors"),
                product("UK", "202606", "A4", "Funko POP! Games: Marvel Rivals - Psylocke - Collectable Vinyl Figure - Gift Idea - Official Merchandise - Toys For Kids & Adults - Model Figure for Collectors and Display", "Toys:Figures", 19, 1500, "13.99", "toys")
        ));
        when(salesBaselineService.getBsrHealth("UK", "toys", 1200, "202606")).thenReturn(baseline("202606", "lt5k", 12, 20, 32, "high", "9.99"));
        when(salesBaselineService.getBsrHealth("UK", "fashion", 2400, "202606")).thenReturn(Map.of(
                "hasBaseline", false,
                "baselineMonth", "202606",
                "bsrBucket", "lt5k"
        ));
        // 小类基线：toys + Drawstring Bags 命中；fashion + Cosmetic Bags 缺
        when(salesBaselineService.getSubcategoryHealth("UK", "toys", "Drawstring Bags", "202606")).thenReturn(subBaseline(
                "202606", "Drawstring Bags", 35, 14, 22, 30, "mid", "8.49"));
        when(salesBaselineService.getSubcategoryHealth("UK", "fashion", "Cosmetic Bags", "202606")).thenReturn(Map.of(
                "hasBaseline", false,
                "baselineMonth", "202606",
                "subCategory", "Cosmetic Bags"
        ));

        ElementDiscoveryService service = new ElementDiscoveryServiceImpl(
                competitorProductMapper,
                new ProductTitleParsingServiceImpl(),
                salesBaselineService
        );

        Map<String, Object> result = service.listManualCandidates("UK", null, 200, 2, null);

        assertThat(result.get("month")).isEqualTo("202606");
        assertThat(result.get("matchedProducts")).isEqualTo(4);
        assertThat(result.get("keptNonStandardProducts")).isEqualTo(2);
        assertThat(result.get("filteredStandardProducts")).isEqualTo(2);
        assertThat(result.get("baselineResolvedCandidates")).isEqualTo(1);
        assertThat(result.get("subcategoryBaselineResolvedCandidates")).isEqualTo(1);
        assertThat(result.get("total")).isEqualTo(2);

        @SuppressWarnings("unchecked")
        Map<String, Integer> filteredByReason = (Map<String, Integer>) result.get("filteredByReason");
        assertThat(filteredByReason)
                .containsEntry("official_merch_or_collectible", 1)
                .containsEntry("poster_schedule_or_event_chart", 1);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) result.get("items");
        assertThat(items).hasSize(2);

        Map<String, Object> first = items.get(0);
        assertThat(first.get("row_id")).isEqualTo(1);
        assertThat(first.get("asin")).isEqualTo("A1");
        assertThat(first.get("matched_carrier_anchor")).isEqualTo("drawstring bag");
        assertThat(first.get("carrier_candidates")).isEqualTo("Drawstring Bag");
        assertThat(first.get("category_hint")).isEqualTo("Drawstring Bags");
        assertThat(first.get("baseline_has_data")).isEqualTo(true);
        assertThat(first.get("baseline_bucket")).isEqualTo("lt5k");
        assertThat(first.get("baseline_p50")).isEqualTo(20);
        assertThat(first.get("sub_baseline_has_data")).isEqualTo(true);
        assertThat(first.get("sub_baseline_subcategory")).isEqualTo("Drawstring Bags");
        assertThat(first.get("sub_baseline_p50")).isEqualTo(14);
        assertThat(first.get("sub_baseline_p75")).isEqualTo(22);
        assertThat(first.get("sub_baseline_p90")).isEqualTo(30);
        assertThat((String) first.get("notes"))
                .contains("baseline=202606/lt5k")
                .contains("sub_baseline=202606/Drawstring Bags")
                .contains("sub_units_p50=14");

        Map<String, Object> second = items.get(1);
        assertThat(second.get("asin")).isEqualTo("A2");
        assertThat(second.get("matched_carrier_anchor")).isEqualTo("cosmetic bag");
        assertThat(second.get("baseline_has_data")).isEqualTo(false);
        assertThat(second.get("sub_baseline_has_data")).isEqualTo(false);
        assertThat(second.get("notes")).isEqualTo("source=carrier_title_match; baseline=none; sub_baseline=none");
    }

    @Test
    void listManualCandidates_filtersKnownToyAndAutomotiveNoisePatterns() {
        when(competitorProductMapper.selectLatestMonth("US")).thenReturn("202606");
        when(competitorProductMapper.selectCleanCandidatesForDiscovery(anyString(), anyString(), anyInt())).thenReturn(List.of(
                product("DE", "202606", "D1", "PLAYMOBIL Fantasy & Magic Orc mit tragbarem Seetang Armband", "Toys:Bracelets", 22, 900, "12.99"),
                product("US", "202606", "U1", "Chemical Guys Orange Degreaser 16 oz - with Microfiber Towel", "Automotive:Towels", 30, 700, "14.99"),
                product("US", "202606", "U2", "2026 FIFA World Cup Sticker Collection - Album", "Sports:Stickers", 18, 1200, "8.99"),
                product("UK", "202606", "K1", "World Cup 2026 Wall Planner Poster for Football Fans", "Sports:Posters", 16, 1500, "7.99"),
                product("UK", "202606", "K2", "Mini Party Hats for Toy Animals", "Party:Hats", 12, 1800, "6.99"),
                product("US", "202606", "U3", "Capybara Garden Flag for Backyard Decor", "Garden:Flags", 25, 2100, "9.99", "garden")
        ));
        when(salesBaselineService.getBsrHealth("US", "garden", 2100, "202606")).thenReturn(baseline("202606", "lt5k", 10, 18, 25, "medium", "8.49"));

        ElementDiscoveryService service = new ElementDiscoveryServiceImpl(
                competitorProductMapper,
                new ProductTitleParsingServiceImpl(),
                salesBaselineService
        );

        Map<String, Object> result = service.listManualCandidates("US", null, 200, 10, null);

        assertThat(result.get("matchedProducts")).isEqualTo(6);
        assertThat(result.get("keptNonStandardProducts")).isEqualTo(1);
        assertThat(result.get("filteredStandardProducts")).isEqualTo(5);
        assertThat(result.get("baselineResolvedCandidates")).isEqualTo(1);
        assertThat(result.get("total")).isEqualTo(1);

        @SuppressWarnings("unchecked")
        Map<String, Integer> filteredByReason = (Map<String, Integer>) result.get("filteredByReason");
        assertThat(filteredByReason)
                .containsEntry("official_merch_or_collectible", 1)
                .containsEntry("utility_or_functional_standard", 1)
                .containsEntry("poster_schedule_or_event_chart", 2)
                .containsEntry("toy_prop_hat_accessory", 1);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) result.get("items");
        assertThat(items).hasSize(1);
        assertThat(items.get(0).get("asin")).isEqualTo("U3");
    }

    @Test
    void listManualCandidates_filtersBandsFramesGenericBottlesAndToyFigureSets() {
        when(competitorProductMapper.selectLatestMonth("UK")).thenReturn("202606");
        when(competitorProductMapper.selectCleanCandidatesForDiscovery(anyString(), anyString(), anyInt())).thenReturn(List.of(
                product("UK", "202606", "B1", "Compatible for Fitbit Air Bracelet Women Anti Sweat Replacement Band Strap", "Wearables:Bands", 18, 900, "8.99"),
                product("US", "202606", "P1", "15x22 Picture Frame for Wall Display, Plexiglass Stable Sturdy Poster Frame", "Home:Frames", 21, 1400, "16.99"),
                product("DE", "202606", "W1", "Trinkflasche 1L, Sportflasche Auslaufsicher, Kohlensäure geeignet", "Sports:Bottles", 25, 1200, "12.99"),
                product("UK", "202606", "F1", "12 Pack Mini Sea Animal Toys for Kids, Realistic Ocean Creatures Figure Set", "Toys:Figures", 17, 1300, "10.99"),
                product("UK", "202606", "K1", "Capybara Garden Flag for Backyard Decor", "Garden:Flags", 25, 2100, "9.99", "garden")
        ));
        when(salesBaselineService.getBsrHealth("UK", "garden", 2100, "202606")).thenReturn(baseline("202606", "lt5k", 10, 18, 25, "medium", "8.49"));

        ElementDiscoveryService service = new ElementDiscoveryServiceImpl(
                competitorProductMapper,
                new ProductTitleParsingServiceImpl(),
                salesBaselineService
        );

        Map<String, Object> result = service.listManualCandidates("UK", null, 200, 10, null);

        assertThat(result.get("matchedProducts")).isEqualTo(5);
        assertThat(result.get("keptNonStandardProducts")).isEqualTo(1);
        assertThat(result.get("filteredStandardProducts")).isEqualTo(4);
        assertThat(result.get("total")).isEqualTo(1);

        @SuppressWarnings("unchecked")
        Map<String, Integer> filteredByReason = (Map<String, Integer>) result.get("filteredByReason");
        assertThat(filteredByReason)
                .containsEntry("smartwatch_band_accessory", 1)
                .containsEntry("picture_frame_display", 1)
                .containsEntry("generic_sports_bottle", 1)
                .containsEntry("toy_figure_set", 1);
    }

    @Test
    void listManualCandidates_filtersBackdropFlagPacksDryBagsAndCoolerAccessories() {
        when(competitorProductMapper.selectLatestMonth("US")).thenReturn("202606");
        when(competitorProductMapper.selectCleanCandidatesForDiscovery(anyString(), anyString(), anyInt())).thenReturn(List.of(
                product("US", "202606", "D1", "2PCS USA Anniversary 250th Flag, 1.5X3 FT Anniversary Fan Flags, Yard Signs Hanging Porch Sign Backdrop", "Party:Backdrops", 18, 1200, "9.99"),
                product("DE", "202606", "L1", "Kühlakkus, 6 Stück Kühlpads Für Kühltasche", "Kitchen:Bags", 15, 1300, "7.99"),
                product("DE", "202606", "T1", "RONGZUBAT 10L wasserdichte Tasche Dry Bag mit Mikrofaser Handtuch", "Outdoor:Towels", 16, 1500, "12.99"),
                product("DE", "202606", "B1", "Tracker Tag für Kinder & Senioren, Tracker für Kleidung und Rucksack", "Travel:Backpacks", 14, 1800, "11.99"),
                product("US", "202606", "K1", "Capybara Garden Flag for Backyard Decor", "Garden:Flags", 25, 2100, "9.99", "garden")
        ));
        when(salesBaselineService.getBsrHealth("US", "garden", 2100, "202606")).thenReturn(baseline("202606", "lt5k", 10, 18, 25, "medium", "8.49"));

        ElementDiscoveryService service = new ElementDiscoveryServiceImpl(
                competitorProductMapper,
                new ProductTitleParsingServiceImpl(),
                salesBaselineService
        );

        Map<String, Object> result = service.listManualCandidates("US", null, 200, 10, null);

        assertThat(result.get("matchedProducts")).isEqualTo(5);
        assertThat(result.get("keptNonStandardProducts")).isEqualTo(1);
        assertThat(result.get("filteredStandardProducts")).isEqualTo(4);
        assertThat(result.get("total")).isEqualTo(1);

        @SuppressWarnings("unchecked")
        Map<String, Integer> filteredByReason = (Map<String, Integer>) result.get("filteredByReason");
        assertThat(filteredByReason)
                .containsEntry("backdrop_flag_pack", 1)
                .containsEntry("lunch_bag_or_cooler_accessory", 1)
                .containsEntry("dry_bag_or_tracker_accessory", 2);
    }

    @Test
    void listManualCandidates_filtersStickerFanAccessoryBundles() {
        when(competitorProductMapper.selectLatestMonth("DE")).thenReturn("202606");
        when(competitorProductMapper.selectCleanCandidatesForDiscovery(anyString(), anyString(), anyInt())).thenReturn(List.of(
                product("DE", "202606", "S1", "18 Stück Deutschland Fanartikel Set für große Fußball-Event 2026-6x Blumenkette, 6x Handfahne & 6x Tattoo Sticker - Zubehör für Public Viewing & Fanmeile - Fanartikel Deutschland", "Sports:Stickers", 18, 1100, "8.99"),
                product("DE", "202606", "S2", "Deutschland Fahrradfahne 3er Set, Deutschlandflagge Fahrrad Fahne mit Tattoo Sticker Reflektor Aufkleber, Deutschland Fanartikel Fußball WM 2026 Deutsche Flagge Deko für Laufrad Roller Fahrradanhänger", "Sports:Stickers", 16, 1300, "7.99"),
                product("DE", "202606", "K1", "Capybara Schlüsselanhänger Geschenk", "Gifts:Keychains", 20, 900, "6.99", "gifts")
        ));
        when(salesBaselineService.getBsrHealth("DE", "gifts", 900, "202606")).thenReturn(baseline("202606", "lt5k", 9, 15, 21, "medium", "6.49"));

        ElementDiscoveryService service = new ElementDiscoveryServiceImpl(
                competitorProductMapper,
                new ProductTitleParsingServiceImpl(),
                salesBaselineService
        );

        Map<String, Object> result = service.listManualCandidates("DE", null, 200, 10, null);

        assertThat(result.get("matchedProducts")).isEqualTo(3);
        assertThat(result.get("keptNonStandardProducts")).isEqualTo(1);
        assertThat(result.get("filteredStandardProducts")).isEqualTo(2);
        assertThat(result.get("total")).isEqualTo(1);

        @SuppressWarnings("unchecked")
        Map<String, Integer> filteredByReason = (Map<String, Integer>) result.get("filteredByReason");
        assertThat(filteredByReason)
                .containsEntry("sticker_fan_set_bundle", 2);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) result.get("items");
        assertThat(items).hasSize(1);
        assertThat(items.get(0).get("asin")).isEqualTo("K1");
    }

    private CompetitorProduct product(String marketplace,
                                      String month,
                                      String asin,
                                      String title,
                                      String nodeLabelPath,
                                      Integer units,
                                      Integer bsr,
                                      String price) {
        return product(marketplace, month, asin, title, nodeLabelPath, units, bsr, price, null);
    }

    private CompetitorProduct product(String marketplace,
                                      String month,
                                      String asin,
                                      String title,
                                      String nodeLabelPath,
                                      Integer units,
                                      Integer bsr,
                                      String price,
                                      String bsrId) {
        CompetitorProduct product = new CompetitorProduct();
        product.setMarketplace(marketplace);
        product.setMonth(month);
        product.setAsin(asin);
        product.setTitle(title);
        product.setNodeLabelPath(nodeLabelPath);
        product.setBsrId(bsrId);
        product.setUnits(units);
        product.setBsr(bsr);
        product.setPrice(new BigDecimal(price));
        return product;
    }

    private Map<String, Object> baseline(String baselineMonth,
                                         String bucket,
                                         int p25,
                                         int p50,
                                         int p75,
                                         String confidence,
                                         String priceAvg) {
        return Map.of(
                "hasBaseline", true,
                "baselineMonth", baselineMonth,
                "bsrBucket", bucket,
                "confidence", confidence,
                "priceAvg", new BigDecimal(priceAvg),
                "units", Map.of(
                        "p25", p25,
                        "p50", p50,
                        "p75", p75
                )
        );
    }

    private Map<String, Object> subBaseline(String baselineMonth,
                                            String subCategory,
                                            int sampleSize,
                                            int p50,
                                            int p75,
                                            int p90,
                                            String confidence,
                                            String pricePriceP50) {
        return Map.of(
                "hasBaseline", true,
                "baselineMonth", baselineMonth,
                "subCategory", subCategory,
                "sampleSize", sampleSize,
                "confidence", confidence,
                "priceP50", new BigDecimal(pricePriceP50),
                "units", Map.of(
                        "p50", p50,
                        "p75", p75,
                        "p90", p90
                )
        );
    }
}
