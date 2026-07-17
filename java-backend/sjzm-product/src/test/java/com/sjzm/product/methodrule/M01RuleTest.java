package com.sjzm.product.methodrule;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class M01RuleTest {

    @Test
    void rejectsKnownSalesAboveMarketplaceMaximum() {
        M01Rule rule = M01Rule.baseline("US");

        assertTrue(rule.matches(20, new BigDecimal("10"), new BigDecimal("100"), 500, null));
        assertFalse(rule.matches(20, new BigDecimal("10"), new BigDecimal("100"), 501, null));
    }

    @Test
    void allowsMissingSalesToUseBsrFallback() {
        M01Rule rule = M01Rule.baseline("UK");

        assertTrue(rule.matches(20, new BigDecimal("10"), new BigDecimal("100"), null, 10000));
    }
}
