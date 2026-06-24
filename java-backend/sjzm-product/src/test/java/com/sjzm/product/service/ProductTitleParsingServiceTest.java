package com.sjzm.product.service;

import com.sjzm.product.dto.ProductTitleParseResult;
import com.sjzm.product.service.impl.ProductTitleParsingServiceImpl;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ProductTitleParsingServiceTest {

    private final ProductTitleParsingService service = new ProductTitleParsingServiceImpl();

    @Test
    void parse_extractsCarrierAndElement() {
        ProductTitleParseResult result = service.parse(
                "Football Canvas Tote Bag, Vibrant Flag Shoulder Bag for Football Lovers"
        );

        assertThat(result.carrier()).isEqualTo("Canvas Tote");
        assertThat(result.element()).isEqualTo("Football");
    }

    @Test
    void parse_prefersLeftMostCarrierInsteadOfSeoTailCarrier() {
        ProductTitleParseResult result = service.parse(
                "Butterfly Keychain Charm Purse Bag Accessory for Women"
        );

        assertThat(result.carrier()).isEqualTo("Keychain");
        assertThat(result.element()).isEqualTo("Butterfly");
    }

    @Test
    void parse_stripsBrandAndNoiseWords() {
        ProductTitleParseResult result = service.parse(
                "Dei tkeyts 2PCS Capybara Glasses Cases Set, Cute Kids Glasses Case"
        );

        assertThat(result.carrier()).isEqualTo("Glasses Case");
        assertThat(result.element()).isEqualTo("Capybara");
    }

    @Test
    void parse_doesNotTreatWorldCupAsMugCarrier() {
        ProductTitleParseResult result = service.parse(
                "World Cup Bunting Flags 48 Teams Flags, 15M 48pcs Bunting Flags Double Sided Fabric Banner for 2026 World Cup Football Party Decoration"
        );

        assertThat(result.hasCarrier()).isFalse();
        assertThat(result.element()).isNull();
    }

    @Test
    void parse_stillSupportsSpecificCoffeeCupPhrase() {
        ProductTitleParseResult result = service.parse(
                "Highland Cow Coffee Cup for Women, Cute Ceramic Gift"
        );

        assertThat(result.carrier()).isEqualTo("Mug");
        assertThat(result.element()).isEqualTo("Highland Cow");
    }

    @Test
    void parse_ignoresCarrierInsideForPhrase() {
        ProductTitleParseResult result = service.parse(
                "Flexible Ice Packs, 4 Packs Long Lasting Reusable Cold Packs for Lunch Boxes, School, Travel and Camping"
        );

        assertThat(result.hasCarrier()).isFalse();
        assertThat(result.element()).isNull();
    }

    @Test
    void listSupportedCarriers_includesDocumentBootstrapCarriers() {
        assertThat(service.listSupportedCarriers())
                .contains("Backdrop", "Placemat", "Clear Bag", "Garden Flag");
    }
}
