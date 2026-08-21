package com.sjzm.product.modules.dataprocessing.logistics;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class PurchaseShipmentAllocatorTest {

    @Test
    void allocatesSameSkuShipmentsToPurchaseBatchesInReceiptOrder() {
        var receipts = List.of(
                receipt("batch-1", "PO1", 1, 100, "2026-08-02T10:00:00"),
                receipt("batch-2", "PO2", 2, 80, "2026-08-05T10:00:00"));
        var shipments = List.of(
                shipment("SP1", 120, "2026-08-06T10:00:00"),
                shipment("SP2", 60, "2026-08-07T10:00:00"));

        var result = PurchaseShipmentAllocator.allocate(receipts, shipments);

        assertThat(result).containsEntry("batch-1", 100).containsEntry("batch-2", 80);
    }

    @Test
    void doesNotAllocateShipmentBeforePurchaseBatchWasReceived() {
        var receipts = List.of(receipt("batch-1", "PO1", 1, 100, "2026-08-05T10:00:00"));
        var shipments = List.of(
                shipment("SP-old", 100, "2026-08-04T10:00:00"),
                shipment("SP-new", 40, "2026-08-06T10:00:00"));

        var result = PurchaseShipmentAllocator.allocate(receipts, shipments);

        assertThat(result).containsEntry("batch-1", 40);
    }

    @Test
    void keepsWarehousesIndependent() {
        var receipts = List.of(new PurchaseShipmentAllocator.Receipt(
                "batch-1", "PO1", 1, "SKU1", 8067, 100,
                LocalDateTime.parse("2026-08-02T10:00:00")));
        var shipments = List.of(new PurchaseShipmentAllocator.Shipment(
                "SP1", "SKU1", 9999, 100,
                LocalDateTime.parse("2026-08-03T10:00:00")));

        assertThat(PurchaseShipmentAllocator.allocate(receipts, shipments)).isEmpty();
    }

    private PurchaseShipmentAllocator.Receipt receipt(String key, String orderSn, long itemId,
                                                        int quantity, String time) {
        return new PurchaseShipmentAllocator.Receipt(
                key, orderSn, itemId, "SKU1", 8067, quantity, LocalDateTime.parse(time));
    }

    private PurchaseShipmentAllocator.Shipment shipment(String id, int quantity, String time) {
        return new PurchaseShipmentAllocator.Shipment(
                id, "SKU1", 8067, quantity, LocalDateTime.parse(time));
    }
}
