package com.sjzm.product.modules.automation.job;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.sjzm.product.modules.automation.config.OperationsLogisticsAutomationConfig;
import com.sjzm.product.modules.automation.entity.AutomationRecordBinding;
import com.sjzm.product.modules.automation.service.AutomationBindingService;
import com.sjzm.product.modules.dataprocessing.logistics.LogisticsPurchaseProgressPipeline;
import com.sjzm.product.modules.dataprocessing.logistics.entity.OperationsLogisticsPurchaseProgress;
import com.sjzm.product.rds.mapper.OperationsLogisticsProgressMapper;
import com.sjzm.product.modules.dataprocessing.pipeline.DataProcessingContext;
import com.sjzm.product.modules.dataprocessing.pipeline.DataProcessingResult;
import com.sjzm.product.modules.dataprocessing.service.DataProcessingCenterService;
import com.sjzm.product.modules.feishu.service.FeishuClient;
import com.sjzm.product.modules.lingxing.service.LingxingShipmentDataService;
import com.sjzm.product.modules.lingxing.service.LingxingPurchaseDataLayerService;
import com.sjzm.product.modules.lingxing.service.LingxingInventoryBatchService;
import com.sjzm.product.modules.lingxing.service.LingxingPurchaseIncrementalService;
import com.sjzm.product.modules.lingxing.service.LingxingInventoryBatchIncrementalService;
import com.sjzm.product.modules.lingxing.service.LingxingShipmentIncrementalService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@Component
@RequiredArgsConstructor
@Slf4j
public class OperationsLogisticsPurchaseProgressJob implements AutomationJob {

    public static final String CODE = "OPERATIONS_LOGISTICS_PURCHASE_PROGRESS";
    private static final String TARGET_TYPE = "FEISHU";
    private static final int BATCH_SIZE = 200;

    private final LingxingShipmentDataService shipmentDataService;
    private final LingxingPurchaseDataLayerService purchaseDataLayerService;
    private final LingxingInventoryBatchService inventoryBatchService;
    private final LingxingPurchaseIncrementalService purchaseIncrementalService;
    private final LingxingInventoryBatchIncrementalService inventoryIncrementalService;
    private final LingxingShipmentIncrementalService shipmentIncrementalService;
    private final DataProcessingCenterService dataProcessingCenterService;
    private final OperationsLogisticsProgressMapper progressMapper;
    private final AutomationBindingService bindingService;
    private final FeishuClient feishuClient;
    private final OperationsLogisticsAutomationConfig config;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public String code() {
        return CODE;
    }

    @Override
    public String name() {
        return "运营物流采购进度同步";
    }

    @Override
    public String description() {
        return "同步领星采购到发货状态，并新增或更新飞书采购单进度表";
    }

    @Override
    public AutomationJobResult execute(AutomationExecutionContext context) {
        AutomationStageTimer timer = new AutomationStageTimer();
        timer.time("validateTarget", this::validateTarget);
        // 默认走增量链路；传 incremental=false 可回退到全量窗口（用于历史回补）
        boolean incremental = !Boolean.FALSE.equals(context.parameters().get("incremental"));
        boolean syncShipments = Boolean.TRUE.equals(context.parameters().get("syncShipments"));

        Map<String, Object> purchaseSync;
        Map<String, Object> purchasePlanSync;
        Map<String, Object> inventorySync;
        Map<String, Object> sourceSync;
        String startDate;
        String endDate;

        if (incremental) {
            // 增量链路：游标驱动，不使用整月固定窗口
            log.info("[OperationsLogistics] 使用增量请求链路（游标驱动）");
            purchaseSync = timer.time("syncPurchaseOrders",
                    purchaseIncrementalService::syncPurchaseOrdersIncremental);
            purchasePlanSync = timer.time("syncPurchasePlans",
                    purchaseIncrementalService::syncPurchasePlansIncremental);
            boolean forceInventory = Boolean.TRUE.equals(context.parameters().get("forceInventory"));
            String inventoryDate = parameter(context, "inventoryDate", LocalDate.now().toString());
            inventorySync = timer.time("syncInventory", () ->
                    inventoryIncrementalService.syncInventoryBatchIncremental(inventoryDate, forceInventory));
            sourceSync = syncShipments
                    ? timer.time("syncShipments", shipmentIncrementalService::syncShipmentActualIncremental)
                    : Map.of("skipped", true, "reason", "syncShipments parameter is false");
            startDate = LocalDate.now().withDayOfMonth(1) + " 00:00:00";
            endDate = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
        } else {
            // 全量链路（历史回补）：保留原有整月窗口
            log.info("[OperationsLogistics] 使用全量请求链路（历史回补）");
            startDate = parameter(context, "startDate",
                    LocalDate.now().withDayOfMonth(1) + " 00:00:00");
            endDate = parameter(context, "endDate",
                    LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
            purchaseSync = timer.time("syncPurchaseOrders", () -> purchaseDataLayerService.syncPurchaseOrders(
                    startDate, endDate, "create_time", List.of(), List.of(), null));
            purchasePlanSync = timer.time("syncPurchasePlans", () -> purchaseDataLayerService.syncPurchasePlans(
                    dateOnly(startDate), dateOnly(endDate), "creator_time", List.of(), List.of(), List.of()));
            String inventoryDate = parameter(context, "inventoryDate", LocalDate.now().toString());
            inventorySync = timer.time("syncInventory", () ->
                    inventoryBatchService.syncDaily(inventoryDate, inventoryDate, null));
            sourceSync = syncShipments
                    ? timer.time("syncShipments", () -> shipmentDataService.syncDateRange(startDate, endDate))
                    : Map.of("skipped", true, "reason", "syncShipments parameter is false");
        }
        DataProcessingResult processing = timer.time("processPurchaseProgress", () -> dataProcessingCenterService.execute(
                LogisticsPurchaseProgressPipeline.CODE,
                new DataProcessingContext(context.triggerType(), context.requestedBy(),
                        context.correlationId(), context.parameters())));

        String resource = targetResource();
        DeliveryPlan deliveryPlan = timer.time("prepareDelivery", () ->
                prepareDelivery(startDate, endDate, resource));
        DeliveryStats createStats = timer.time("publishFeishuCreates", () ->
                deliverCreates(deliveryPlan.creates(), resource));
        DeliveryStats updateStats = timer.time("publishFeishuUpdates", () ->
                deliverUpdates(deliveryPlan.updates(), resource));
        long success = createStats.success() + updateStats.success();
        long failed = createStats.failed() + updateStats.failed();

        Map<String, Object> details = new LinkedHashMap<>();
        details.put("mode", incremental ? "INCREMENTAL" : "FULL");
        details.put("sourceSync", sourceSync);
        details.put("purchaseSync", purchaseSync);
        details.put("purchasePlanSync", purchasePlanSync);
        details.put("inventorySync", inventorySync);
        details.put("processing", processing);
        details.put("created", deliveryPlan.creates().size());
        details.put("updated", deliveryPlan.updates().size());
        details.put("startDate", startDate);
        details.put("endDate", endDate);
        details.put("stageDurationsMs", timer.snapshot());
        return new AutomationJobResult(deliveryPlan.rows().size(), success, failed,
                deliveryPlan.skipped(), details);
    }

    private DeliveryPlan prepareDelivery(String startDate, String endDate, String resource) {
        List<OperationsLogisticsPurchaseProgress> rows = progressMapper.selectForDelivery(startDate, endDate);
        List<DeliveryItem> creates = new ArrayList<>();
        List<DeliveryItem> updates = new ArrayList<>();
        long skipped = 0;
        for (OperationsLogisticsPurchaseProgress row : rows) {
            AutomationRecordBinding binding = bindingService.find(CODE, row.getBusinessKey(),
                    TARGET_TYPE, resource);
            if (binding != null && Integer.valueOf(1).equals(binding.getTerminal())) {
                skipped++;
                continue;
            }
            if (binding != null && row.getSourceHash().equals(binding.getLastSourceHash())) {
                skipped++;
                continue;
            }
            DeliveryItem item = new DeliveryItem(row, binding);
            if (binding == null) creates.add(item);
            else updates.add(item);
        }
        return new DeliveryPlan(rows, creates, updates, skipped);
    }

    private DeliveryStats deliverCreates(List<DeliveryItem> creates, String resource) {
        long success = 0;
        long failed = 0;
        for (int from = 0; from < creates.size(); from += BATCH_SIZE) {
            List<DeliveryItem> batch = creates.subList(from, Math.min(from + BATCH_SIZE, creates.size()));
            try {
                success += createBatch(batch, resource);
            } catch (RuntimeException ex) {
                failed += batch.size();
                log.error("飞书采购进度批量新增失败: from={}, size={}, reason={}",
                        from, batch.size(), ex.getMessage(), ex);
            }
        }
        return new DeliveryStats(success, failed);
    }

    private DeliveryStats deliverUpdates(List<DeliveryItem> updates, String resource) {
        long success = 0;
        long failed = 0;
        for (int from = 0; from < updates.size(); from += BATCH_SIZE) {
            List<DeliveryItem> batch = updates.subList(from, Math.min(from + BATCH_SIZE, updates.size()));
            try {
                updateBatch(batch, resource);
                success += batch.size();
            } catch (RuntimeException ex) {
                failed += batch.size();
                log.error("飞书采购进度批量更新失败: from={}, size={}, reason={}",
                        from, batch.size(), ex.getMessage(), ex);
            }
        }
        return new DeliveryStats(success, failed);
    }

    private long createBatch(List<DeliveryItem> batch, String resource) {
        ArrayNode records = objectMapper.createArrayNode();
        batch.forEach(item -> records.add(objectMapper.createObjectNode().set("fields", fields(item.row()))));
        JsonNode response = feishuClient.batchCreateRecords(config.getFeishuAppToken(),
                config.getFeishuTableId(), records);
        JsonNode created = response.path("data").path("records");
        if (!created.isArray() || created.size() != batch.size()) {
            throw new IllegalStateException("飞书批量新增返回记录数不一致");
        }
        for (int i = 0; i < batch.size(); i++) {
            String recordId = created.get(i).path("record_id").asText();
            if (!StringUtils.hasText(recordId)) throw new IllegalStateException("飞书新增记录缺少 record_id");
            saveBinding(batch.get(i).row(), null, recordId, resource);
        }
        return batch.size();
    }

    private void updateBatch(List<DeliveryItem> batch, String resource) {
        ArrayNode records = objectMapper.createArrayNode();
        for (DeliveryItem item : batch) {
            ObjectNode record = objectMapper.createObjectNode();
            record.put("record_id", item.binding().getTargetRecordId());
            record.set("fields", fields(item.row()));
            records.add(record);
        }
        feishuClient.batchUpdateRecords(config.getFeishuAppToken(), config.getFeishuTableId(), records);
        batch.forEach(item -> saveBinding(item.row(), item.binding(),
                item.binding().getTargetRecordId(), resource));
    }

    private ObjectNode fields(OperationsLogisticsPurchaseProgress row) {
        ObjectNode fields = objectMapper.createObjectNode();
        fields.put("创建批次号", row.getPpgSn());
        if (row.getStockTime() != null) {
            fields.put("备货时间", row.getStockTime().atZone(java.time.ZoneId.systemDefault())
                    .toInstant().toEpochMilli());
        }
        fields.put("領星SKU", row.getSku());
        fields.put("备货数量", row.getPurchaseQuantity());
        fields.put("进度", row.getProgressValue());
        fields.put("跟进状态", row.getFollowUpStatus());
        return fields;
    }

    private void saveBinding(OperationsLogisticsPurchaseProgress row,
                             AutomationRecordBinding current,
                             String recordId, String resource) {
        AutomationRecordBinding binding = new AutomationRecordBinding();
        if (current != null) binding.setId(current.getId());
        binding.setJobCode(CODE);
        binding.setBusinessKey(row.getBusinessKey());
        binding.setTargetType(TARGET_TYPE);
        binding.setTargetResource(resource);
        binding.setTargetRecordId(recordId);
        binding.setLastSourceHash(row.getSourceHash());
        binding.setLastBusinessStatus(row.getProgressStatus());
        binding.setTerminal(row.getTerminal());
        bindingService.bind(binding);
    }

    private void validateTarget() {
        if (!StringUtils.hasText(config.getFeishuAppToken())
                || !StringUtils.hasText(config.getFeishuTableId())) {
            throw new IllegalStateException("未配置运营物流飞书 app token/table id");
        }
    }

    private String targetResource() {
        return config.getFeishuAppToken() + ":" + config.getFeishuTableId();
    }

    private String parameter(AutomationExecutionContext context, String name, String defaultValue) {
        Object value = context.parameters().get(name);
        return value == null || String.valueOf(value).isBlank()
                ? defaultValue
                : String.valueOf(value).trim();
    }

    private String dateOnly(String value) {
        if (value == null || value.length() < 10) {
            throw new IllegalArgumentException("时间参数必须为 yyyy-MM-dd 开头: " + value);
        }
        return value.substring(0, 10);
    }

    private record DeliveryItem(OperationsLogisticsPurchaseProgress row,
                                AutomationRecordBinding binding) {
    }

    private record DeliveryPlan(List<OperationsLogisticsPurchaseProgress> rows,
                                List<DeliveryItem> creates,
                                List<DeliveryItem> updates,
                                long skipped) {
    }

    private record DeliveryStats(long success, long failed) {
    }
}
