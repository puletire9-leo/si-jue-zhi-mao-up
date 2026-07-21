package com.sjzm.product.service;

import com.sjzm.product.entity.CompetitorProduct;
import com.sjzm.product.methodrule.M01Rule;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class ProductFeatureProcessorTest {

    private final ProductFeatureProcessor processor = new ProductFeatureProcessor();

    @Test
    void classifySalesTierUsesConfiguredBoundaries() {
        assertEquals("A", processor.classifySalesTier(100));
        assertEquals("A", processor.classifySalesTier(120));
        assertEquals("B", processor.classifySalesTier(50));
        assertEquals("B", processor.classifySalesTier(99));
        assertEquals("C", processor.classifySalesTier(15));
        assertEquals("C", processor.classifySalesTier(49));
        assertEquals("D", processor.classifySalesTier(0));
        assertEquals("D", processor.classifySalesTier(14));
        assertEquals("UNKNOWN", processor.classifySalesTier(null));
    }

    @Test
    void applyBaseFeaturesSetsReusableFactsOnly() {
        CompetitorProduct product = new CompetitorProduct();
        product.setAsin("B0TEST1234");
        product.setImageUrl("https://example.test/image.jpg");
        product.setUnits(55);
        product.setWeight("250 g");

        processor.applyBaseFeatures(product, "UK", "新品榜");

        assertEquals(M01Rule.UNKNOWN_LISTING_DAYS_DEFAULT, product.getListingDays());
        assertEquals(0, new BigDecimal("250").compareTo(product.getWeightG()));
        assertEquals("B", product.getSalesTier());
        assertEquals("https://www.amazon.co.uk/dp/B0TEST1234", product.getProductUrl());
        assertEquals(
                "https://www.amazon.co.uk/stylesnap?q=https%3A%2F%2Fexample.test%2Fimage.jpg",
                product.getSimilarUrl());
        assertEquals("新品榜", product.getSource());
        assertNull(product.getM01Active());
    }

    @Test
    void extractWeightGramsKeepsExistingSupportedUnits() {
        assertEquals(0, new BigDecimal("1000").compareTo(processor.extractWeightGrams("1 kg")));
        assertEquals(0, new BigDecimal("28.3495").compareTo(processor.extractWeightGrams("1 ounces")));
        assertEquals(0, new BigDecimal("453.592").compareTo(processor.extractWeightGrams("1 pounds")));
        assertNull(processor.extractWeightGrams("unknown"));
    }
}
