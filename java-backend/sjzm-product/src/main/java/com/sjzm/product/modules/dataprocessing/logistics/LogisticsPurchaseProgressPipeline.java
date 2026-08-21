package com.sjzm.product.modules.dataprocessing.logistics;

import com.sjzm.product.modules.dataprocessing.logistics.entity.OperationsLogisticsPurchaseProgress;
import com.sjzm.product.rds.mapper.OperationsLogisticsProgressMapper;
import com.sjzm.product.rds.service.RdsBatchWriteService;
import com.sjzm.product.modules.dataprocessing.pipeline.DataProcessingContext;
import com.sjzm.product.modules.dataprocessing.pipeline.DataProcessingPipeline;
import com.sjzm.product.modules.dataprocessing.pipeline.DataProcessingResult;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class LogisticsPurchaseProgressPipeline implements DataProcessingPipeline {

    public static final String CODE = "LOGISTICS_PURCHASE_PROGRESS";

    private final OperationsLogisticsProgressMapper mapper;
    private final RdsBatchWriteService rdsBatchWriteService;

    @Override
    public String code() {
        return CODE;
    }

    @Override
    public String name() {
        return "运营物流采购进度";
    }

    @Override
    public String description() {
        return "将采购到货、发货计划和实际SP归并为待到货/待发货/已发货";
    }

    @Override
    public DataProcessingResult execute(DataProcessingContext context) {
        String startDate = parameter(context, "startDate",
                LocalDate.now().withDayOfMonth(1) + " 00:00:00");
        String endDate = parameter(context, "endDate",
                LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
        List<Map<String, Object>> candidates = mapper.selectCandidates(startDate, endDate);
        Map<String, Integer> shippedQuantityByBusinessKey = PurchaseShipmentAllocator.allocate(
                mapper.selectAllocationReceipts(startDate, endDate).stream().map(this::toReceipt).toList(),
                mapper.selectValidShipmentEvents(endDate).stream().map(this::toShipment).toList());
        List<OperationsLogisticsPurchaseProgress> progressRows = new java.util.ArrayList<>(candidates.size());
        for (Map<String, Object> candidate : candidates) {
            int allocatedQuantity = shippedQuantityByBusinessKey.getOrDefault(
                    text(candidate.get("businessKey")), 0);
            candidate.put("validShippedQuantity", allocatedQuantity);
            candidate.put("linkedPlanCount", allocatedQuantity > 0 ? 1 : 0);
            progressRows.add(toProgress(candidate));
        }
        long written = rdsBatchWriteService.execute(OperationsLogisticsProgressMapper.class,
                progressRows, 500, OperationsLogisticsProgressMapper::upsert);
        return new DataProcessingResult(candidates.size(), written, 0, 0,
                Map.of("pipeline", CODE, "startDate", startDate, "endDate", endDate));
    }

    private PurchaseShipmentAllocator.Receipt toReceipt(Map<String, Object> source) {
        int receivedQuantity = number(source.get("receivedQuantity"));
        int quantity = receivedQuantity > 0 ? receivedQuantity : number(source.get("purchaseQuantity"));
        return new PurchaseShipmentAllocator.Receipt(
                text(source.get("businessKey")), text(source.get("orderSn")),
                longNumber(source.get("itemId")) == null ? 0L : longNumber(source.get("itemId")),
                text(source.get("sku")), longValue(source.get("wid")), quantity,
                dateTime(source.get("receiptTime")));
    }

    private PurchaseShipmentAllocator.Shipment toShipment(Map<String, Object> source) {
        return new PurchaseShipmentAllocator.Shipment(
                text(source.get("shipmentEventId")), text(source.get("sku")),
                longValue(source.get("wid")), number(source.get("shippedQuantity")),
                dateTime(source.get("shipmentTime")));
    }

    private OperationsLogisticsPurchaseProgress toProgress(Map<String, Object> source) {
        int purchaseQuantity = number(source.get("purchaseQuantity"));
        int receivedQuantity = number(source.get("receivedQuantity"));
        int availableQuantity = number(source.get("availableQuantity"));
        int validShippedQuantity = number(source.get("validShippedQuantity"));
        PurchaseProgressCalculator.Result state = PurchaseProgressCalculator.calculate(
                availableQuantity, validShippedQuantity, number(source.get("linkedPlanCount")));

        OperationsLogisticsPurchaseProgress row = new OperationsLogisticsPurchaseProgress();
        row.setBusinessKey(text(source.get("businessKey")));
        row.setOrderSn(text(source.get("orderSn")));
        row.setItemId(longNumber(source.get("itemId")));
        row.setPlanSn(text(source.get("planSn")));
        row.setPpgSn(text(source.get("ppgSn")));
        row.setSku(text(source.get("sku")));
        if (source.get("stockTime") instanceof LocalDateTime value) row.setStockTime(value);
        else if (source.get("stockTime") instanceof java.sql.Timestamp value) row.setStockTime(value.toLocalDateTime());
        row.setPurchaseQuantity(purchaseQuantity);
        row.setReceivedQuantity(receivedQuantity);
        row.setAvailableQuantity(availableQuantity);
        row.setValidShippedQuantity(validShippedQuantity);
        row.setProgressStatus(state.status());
        row.setProgressValue(state.progress());
        row.setFollowUpStatus(state.followUpStatus());
        row.setAssociationStatus(state.associationStatus());
        row.setTerminal(state.terminal() ? 1 : 0);
        row.setCalculatedAt(LocalDateTime.now());
        row.setSourceHash(hash(row));
        return row;
    }

    private String hash(OperationsLogisticsPurchaseProgress row) {
        String payload = String.join("|", row.getBusinessKey(), row.getOrderSn(), row.getPlanSn(),
                row.getPpgSn(), row.getSku(),
                String.valueOf(row.getPurchaseQuantity()), String.valueOf(row.getReceivedQuantity()),
                String.valueOf(row.getAvailableQuantity()), String.valueOf(row.getValidShippedQuantity()),
                row.getProgressStatus(),
                row.getAssociationStatus());
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(payload.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception ex) {
            throw new IllegalStateException("无法计算采购进度哈希", ex);
        }
    }

    private int number(Object value) {
        return value instanceof Number number ? number.intValue() : 0;
    }

    private Long longNumber(Object value) {
        return value instanceof Number number ? number.longValue() : null;
    }

    private long longValue(Object value) {
        return value instanceof Number number ? number.longValue() : 0L;
    }

    private LocalDateTime dateTime(Object value) {
        if (value instanceof LocalDateTime dateTime) return dateTime;
        if (value instanceof java.sql.Timestamp timestamp) return timestamp.toLocalDateTime();
        return null;
    }

    private String text(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private String parameter(DataProcessingContext context, String name, String defaultValue) {
        Object value = context.parameters().get(name);
        return value == null || String.valueOf(value).isBlank()
                ? defaultValue
                : String.valueOf(value).trim();
    }
}
