package com.sjzm.product.modules.dataprocessing.logistics;

import java.time.LocalDateTime;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public final class PurchaseShipmentAllocator {

    private PurchaseShipmentAllocator() {
    }

    public static Map<String, Integer> allocate(List<Receipt> receipts, List<Shipment> shipments) {
        Map<StockKey, List<ReceiptBalance>> receiptGroups = new HashMap<>();
        for (Receipt receipt : receipts) {
            if (receipt.quantity() <= 0 || receipt.receiptTime() == null) continue;
            receiptGroups.computeIfAbsent(new StockKey(receipt.sku(), receipt.wid()), ignored -> new ArrayList<>())
                    .add(new ReceiptBalance(receipt));
        }

        Map<StockKey, List<Shipment>> shipmentGroups = new HashMap<>();
        for (Shipment shipment : shipments) {
            if (shipment.quantity() <= 0 || shipment.shipmentTime() == null) continue;
            shipmentGroups.computeIfAbsent(new StockKey(shipment.sku(), shipment.wid()), ignored -> new ArrayList<>())
                    .add(shipment);
        }

        Map<String, Integer> allocated = new HashMap<>();
        for (Map.Entry<StockKey, List<ReceiptBalance>> entry : receiptGroups.entrySet()) {
            List<ReceiptBalance> groupReceipts = entry.getValue();
            groupReceipts.sort(Comparator
                    .comparing((ReceiptBalance balance) -> balance.receipt.receiptTime())
                    .thenComparing(balance -> balance.receipt.orderSn())
                    .thenComparing(balance -> balance.receipt.itemId()));

            List<Shipment> groupShipments = shipmentGroups.getOrDefault(entry.getKey(), List.of()).stream()
                    .sorted(Comparator.comparing(Shipment::shipmentTime).thenComparing(Shipment::eventId))
                    .toList();
            ArrayDeque<ReceiptBalance> available = new ArrayDeque<>();
            int receiptIndex = 0;

            for (Shipment shipment : groupShipments) {
                while (receiptIndex < groupReceipts.size()
                        && !groupReceipts.get(receiptIndex).receipt.receiptTime().isAfter(shipment.shipmentTime())) {
                    available.addLast(groupReceipts.get(receiptIndex++));
                }

                int remainingShipment = shipment.quantity();
                while (remainingShipment > 0 && !available.isEmpty()) {
                    ReceiptBalance current = available.peekFirst();
                    int quantity = Math.min(remainingShipment, current.remaining);
                    allocated.merge(current.receipt.businessKey(), quantity, Integer::sum);
                    current.remaining -= quantity;
                    remainingShipment -= quantity;
                    if (current.remaining == 0) available.removeFirst();
                }
            }
        }
        return allocated;
    }

    public record Receipt(String businessKey, String orderSn, long itemId, String sku,
                          long wid, int quantity, LocalDateTime receiptTime) {
    }

    public record Shipment(String eventId, String sku, long wid, int quantity,
                           LocalDateTime shipmentTime) {
    }

    private record StockKey(String sku, long wid) {
    }

    private static final class ReceiptBalance {
        private final Receipt receipt;
        private int remaining;

        private ReceiptBalance(Receipt receipt) {
            this.receipt = receipt;
            this.remaining = receipt.quantity();
        }
    }
}
