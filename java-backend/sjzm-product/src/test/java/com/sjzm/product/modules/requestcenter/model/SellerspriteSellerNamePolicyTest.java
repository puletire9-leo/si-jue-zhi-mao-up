package com.sjzm.product.modules.requestcenter.model;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SellerspriteSellerNamePolicyTest {

    @Test
    void blocksAmazonAfterTrimmingAndIgnoringCase() {
        assertTrue(SellerspriteSellerNamePolicy.isBlocked("Amazon"));
        assertTrue(SellerspriteSellerNamePolicy.isBlocked(" amazon "));
        assertTrue(SellerspriteSellerNamePolicy.isBlocked("AMAZON"));
    }

    @Test
    void doesNotBlockOtherSellerNames() {
        assertFalse(SellerspriteSellerNamePolicy.isBlocked(null));
        assertFalse(SellerspriteSellerNamePolicy.isBlocked(""));
        assertFalse(SellerspriteSellerNamePolicy.isBlocked("Amazon Basics Store"));
        assertFalse(SellerspriteSellerNamePolicy.isBlocked("Amazonia"));
    }
}
