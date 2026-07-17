package com.sjzm.product.modules.requestcenter.model;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SellerspriteShopFetchPolicyTest {

    @Test
    void allowsAtMostTenRequestsPerShop() {
        assertFalse(SellerspriteShopFetchPolicy.reachedRequestLimit(0));
        assertFalse(SellerspriteShopFetchPolicy.reachedRequestLimit(9));
        assertTrue(SellerspriteShopFetchPolicy.reachedRequestLimit(10));
        assertTrue(SellerspriteShopFetchPolicy.reachedRequestLimit(11));
    }
}
