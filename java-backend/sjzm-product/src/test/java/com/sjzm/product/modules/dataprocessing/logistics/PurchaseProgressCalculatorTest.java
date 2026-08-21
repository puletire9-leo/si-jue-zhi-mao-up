package com.sjzm.product.modules.dataprocessing.logistics;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PurchaseProgressCalculatorTest {

    @Test
    void receivedButPendingInspectionRemainsPendingArrival() {
        var result = PurchaseProgressCalculator.calculate(0, 0, 0);

        assertThat(result.status()).isEqualTo("PENDING_ARRIVAL");
        assertThat(result.followUpStatus()).isEqualTo("待到货");
        assertThat(result.progress()).isEqualByComparingTo("0");
    }

    @Test
    void positiveAvailableQuantityIsPendingShipment() {
        var result = PurchaseProgressCalculator.calculate(10, 0, 0);

        assertThat(result.status()).isEqualTo("PENDING_SHIPMENT");
        assertThat(result.followUpStatus()).isEqualTo("待发货");
        assertThat(result.terminal()).isFalse();
    }

    @Test
    void zeroAvailableQuantityIsNotPendingShipment() {
        var result = PurchaseProgressCalculator.calculate(0, 0, 0);

        assertThat(result.status()).isEqualTo("PENDING_ARRIVAL");
        assertThat(result.followUpStatus()).isEqualTo("待到货");
        assertThat(result.terminal()).isFalse();
    }

    @Test
    void anyValidSpShipmentMarksPurchaseAsShipped() {
        var result = PurchaseProgressCalculator.calculate(0, 95, 1);

        assertThat(result.status()).isEqualTo("SHIPPED");
        assertThat(result.followUpStatus()).isEqualTo("已发货");
        assertThat(result.progress()).isEqualByComparingTo("1");
        assertThat(result.terminal()).isTrue();
    }

    @Test
    void validSpShipmentTakesPriorityOverStaleArrivalStatus() {
        var result = PurchaseProgressCalculator.calculate(0, 1, 1);

        assertThat(result.followUpStatus()).isEqualTo("已发货");
        assertThat(result.terminal()).isTrue();
    }
}
