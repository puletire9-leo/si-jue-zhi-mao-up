package com.sjzm.product.modules.dataprocessing.logistics;

import java.math.BigDecimal;

public final class PurchaseProgressCalculator {

    private PurchaseProgressCalculator() {
    }

    public static Result calculate(int availableQuantity, int validShippedQuantity,
                                   int linkedPlanCount) {
        if (validShippedQuantity > 0) {
            return new Result("SHIPPED", "已发货", BigDecimal.ONE, true, "LINKED");
        }

        if (availableQuantity > 0) {
            return new Result("PENDING_SHIPMENT", "待发货", new BigDecimal("0.5"), false,
                    linkedPlanCount > 0 ? "LINKED" : "UNLINKED");
        }

        return new Result("PENDING_ARRIVAL", "待到货", BigDecimal.ZERO, false,
                linkedPlanCount > 0 ? "LINKED" : "UNLINKED");
    }

    public record Result(String status, String followUpStatus, BigDecimal progress,
                         boolean terminal, String associationStatus) {
    }
}
