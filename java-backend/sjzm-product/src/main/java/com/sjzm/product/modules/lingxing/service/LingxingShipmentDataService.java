package com.sjzm.product.modules.lingxing.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.sjzm.product.rds.mapper.LingxingShipmentDataMapper;
import com.sjzm.product.rds.service.RdsBatchWriteService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class LingxingShipmentDataService {

    private static final String PLAN_PATH = "/erp/sc/data/fba_report/shipmentPlanLists";
    private static final String ACTUAL_PATH = "/erp/sc/routing/storage/shipment/getInboundShipmentList";
    private static final int PAGE_SIZE = 200;

    private final LingxingClient client;
    private final LingxingShipmentDataMapper mapper;
    private final RdsBatchWriteService rdsBatchWriteService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public Map<String, Object> syncTrackedSkus() {
        java.time.LocalDateTime end = java.time.LocalDateTime.now();
        return syncDateRange(end.minusDays(30).format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")),
                end.format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
    }

    /**
     * 艾为同口径：实际 SP 按更新时间范围全量分页，计划按实际 RP 批次和已到仓采购 SKU 补齐。
     */
    public Map<String, Object> syncDateRange(String startDate, String endDate) {
        ActualSyncResult actualSync = syncActualsByTimeRange(startDate, endDate);
        Set<String> syncedSeqs = new LinkedHashSet<>();
        long plans = 0;
        long failedSeqs = 0;
        int seqIndex = 0;
        for (String seq : actualSync.seqs()) {
            try {
                plans += syncPlans("seq", seq);
                syncedSeqs.add(seq);
            } catch (RuntimeException ex) {
                failedSeqs++;
                log.error("领星发货计划按批次同步失败: seq={}", seq, ex);
            }
            if (++seqIndex < actualSync.seqs().size()) sleep();
        }

        List<String> skus = mapper.selectTrackedSkus(startDate, endDate);
        long failed = 0;
        for (int index = 0; index < skus.size(); index++) {
            String sku = skus.get(index);
            try {
                plans += syncPlans("sku", sku);
            } catch (RuntimeException ex) {
                failed++;
                log.error("领星发货计划按采购 SKU 同步失败: sku={}", sku, ex);
            }
            if (index < skus.size() - 1) sleep();
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("startDate", startDate);
        result.put("endDate", endDate);
        result.put("actualShipmentsFetched", actualSync.shipmentsFetched());
        result.put("actualRows", actualSync.rowsWritten());
        result.put("actualPages", actualSync.pages());
        result.put("actualSeqs", actualSync.seqs().size());
        result.put("planSeqsSynced", syncedSeqs.size());
        result.put("purchaseSkus", skus.size());
        result.put("planRows", plans);
        result.put("failedSeqs", failedSeqs);
        result.put("failedSkus", failed);
        return result;
    }

    public int syncPlansBySeq(String seq) {
        return syncPlans("seq", seq);
    }

    public int syncPlansBySku(String sku) {
        return syncPlans("sku", sku);
    }

    public int bindPlan(long ispId, String purchaseOrderSn, String purchasePlanSn) {
        if (!StringUtils.hasText(purchaseOrderSn) || !StringUtils.hasText(purchasePlanSn)) {
            throw new IllegalArgumentException("采购单号和采购计划号不能为空");
        }
        return mapper.bindPlan(ispId, purchaseOrderSn.trim(), purchasePlanSn.trim());
    }

    private int syncPlans(String searchField, String searchValue) {
        int written = 0;
        for (int offset = 0; ; offset += 100) {
            ObjectNode body = objectMapper.createObjectNode();
            body.put("search_field", searchField);
            body.put("search_value", searchValue);
            body.put("offset", offset);
            body.put("length", 100);
            JsonNode response = client.post(PLAN_PATH, body);
            JsonNode groups = response.path("data");
            if (!groups.isArray() || groups.isEmpty()) break;
            int pageRows = 0;
            List<Map<String, Object>> planRows = new ArrayList<>();
            for (JsonNode group : groups) {
                JsonNode list = group.path("list");
                if (!list.isArray()) continue;
                for (JsonNode item : list) {
                    planRows.add(mapPlan(group, item));
                }
            }
            pageRows = rdsBatchWriteService.execute(LingxingShipmentDataMapper.class,
                    planRows, 200, LingxingShipmentDataMapper::upsertPlan);
            written += pageRows;
            if (pageRows < 100) break;
            sleep();
        }
        return written;
    }

    public ActualSyncResult syncActualsByTimeRange(String startDate, String endDate) {
        int shipmentsFetched = 0;
        int written = 0;
        int pages = 0;
        Set<String> seqs = new LinkedHashSet<>();
        for (int offset = 0; ; offset += PAGE_SIZE) {
            ObjectNode body = objectMapper.createObjectNode();
            body.put("time_type", 4);
            body.put("start_date", startDate);
            body.put("end_date", endDate);
            body.put("offset", offset);
            body.put("length", PAGE_SIZE);
            JsonNode response = client.post(ACTUAL_PATH, body);
            JsonNode data = response.path("data");
            JsonNode list = data.path("list");
            if (!list.isArray() || list.isEmpty()) break;
            pages++;
            shipmentsFetched += list.size();
            List<Map<String, Object>> actualRows = new ArrayList<>();
            for (JsonNode shipment : list) {
                for (Map<String, Object> row : flattenActual(shipment)) {
                    actualRows.add(row);
                    Object seq = row.get("seq");
                    if (seq != null && StringUtils.hasText(String.valueOf(seq))) {
                        seqs.add(String.valueOf(seq));
                    }
                }
            }
            written += rdsBatchWriteService.execute(LingxingShipmentDataMapper.class,
                    actualRows, PAGE_SIZE, LingxingShipmentDataMapper::upsertActual);
            if (offset + PAGE_SIZE >= data.path("total").asInt(0)) break;
            sleep();
        }
        return new ActualSyncResult(shipmentsFetched, written, pages, seqs);
    }

    private Map<String, Object> mapPlan(JsonNode group, JsonNode item) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("ispId", longValue(item, "isp_id"));
        row.put("ispgId", longValue(item, "ispg_id"));
        row.put("orderSn", text(item, "order_sn"));
        row.put("seq", text(item, "seq"));
        row.put("sku", text(item, "sku"));
        row.put("msku", text(item, "msku"));
        row.put("fnsku", text(item, "fnsku"));
        row.put("productName", text(item, "product_name"));
        row.put("productId", longValue(item, "product_id"));
        row.put("picUrl", text(item, "pic_url"));
        row.put("smallImageUrl", text(item, "small_image_url"));
        row.put("sid", longValue(item, "sid"));
        row.put("sname", text(item, "sname"));
        row.put("nation", text(item, "nation"));
        row.put("wid", longValue(item, "wid"));
        row.put("wname", text(item, "wname"));
        row.put("packingType", intValue(item, "packing_type"));
        row.put("packingTypeName", text(item, "packing_type_name"));
        row.put("shipmentPlanQuantity", intValue(item, "shipment_plan_quantity"));
        row.put("shipmentTime", text(item, "shipment_time"));
        row.put("status", intValue(item, "status"));
        row.put("statusName", text(item, "status_name"));
        row.put("isRelateMws", intValue(item, "is_relate_mws"));
        JsonNode relate = item.path("mws_relate");
        JsonNode first = relate.isArray() && !relate.isEmpty() ? relate.get(0) : objectMapper.createObjectNode();
        row.put("shipmentListSn", text(first, "shipment_list_sn"));
        row.put("shipmentMwsSn", text(first, "shipment_mws_sn"));
        row.put("batchRemark", text(group, "remark"));
        row.put("remark", text(item, "remark"));
        row.put("createUser", text(item, "create_user"));
        row.put("createTimeRemote", text(item, "create_time"));
        row.put("rawJson", item.toString());
        return row;
    }

    private List<Map<String, Object>> flattenActual(JsonNode shipment) {
        List<Map<String, Object>> rows = new ArrayList<>();
        JsonNode relates = shipment.path("relate_list");
        if (!relates.isArray()) return rows;
        for (JsonNode relate : relates) {
            JsonNode orders = relate.path("shipment_order_list");
            if (!orders.isArray()) continue;
            for (JsonNode order : orders) {
                if (longValue(order, "ispr_id") == null || longValue(order, "isp_id") == null) continue;
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("isprId", longValue(order, "ispr_id"));
                row.put("ispId", longValue(order, "isp_id"));
                row.put("shipmentSn", text(shipment, "shipment_sn"));
                row.put("seq", text(order, "seq"));
                row.put("shipmentPlanSn", text(order, "shipment_plan_sn"));
                row.put("shipmentPlanQuantity", intValue(order, "shipment_plan_quantity"));
                row.put("shipmentListQuantity", intValue(order, "shipment_list_quantity"));
                row.put("shipmentMwsQuantity", intValue(order, "shipment_mws_quantity"));
                row.put("shipmentStatus", intValue(shipment, "status"));
                row.put("shipmentStatusName", text(shipment, "status_name"));
                row.put("shipmentTime", firstText(shipment, "shipment_time_second", "shipment_time"));
                row.put("wname", text(shipment, "wname"));
                row.put("wid", longValue(shipment, "wid"));
                row.put("createUser", text(shipment, "create_user"));
                row.put("createTimeRemote", firstText(shipment, "gmt_create", "create_time"));
                row.put("updateTimeRemote", text(shipment, "update_time"));
                row.put("relateId", longValue(relate, "id"));
                row.put("shipmentId", text(relate, "shipment_id"));
                row.put("shipmentStatusMws", text(relate, "shipment_status"));
                row.put("sku", text(relate, "sku"));
                row.put("msku", text(relate, "msku"));
                row.put("fnsku", text(relate, "fnsku"));
                row.put("productName", text(relate, "product_name"));
                row.put("num", intValue(relate, "num"));
                row.put("applyNum", intValue(relate, "apply_num"));
                row.put("sname", text(relate, "sname"));
                row.put("sid", longValue(relate, "sid"));
                row.put("nation", text(relate, "nation"));
                row.put("picUrl", text(relate, "pic_url"));
                row.put("asin", text(relate, "asin"));
                row.put("productId", longValue(relate, "product_id"));
                row.put("methodName", text(shipment, "method_name"));
                row.put("logisticsChannelName", text(shipment, "logistics_channel_name"));
                row.put("expectedArrivalDate", text(shipment, "expected_arrival_date"));
                Integer status = intValue(shipment, "status");
                row.put("isFinal", status != null && (status == 2 || status == 3) ? 1 : 0);
                row.put("rawJson", shipment.toString());
                rows.add(row);
            }
        }
        return rows;
    }

    private String text(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isMissingNode() || value.isNull() ? null : value.asText();
    }

    private String firstText(JsonNode node, String first, String second) {
        String value = text(node, first);
        return StringUtils.hasText(value) ? value : text(node, second);
    }

    private Long longValue(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isNumber() ? value.asLong() : StringUtils.hasText(value.asText()) ? Long.valueOf(value.asText()) : null;
    }

    private Integer intValue(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isNumber() ? value.asInt() : StringUtils.hasText(value.asText()) ? Integer.valueOf(value.asText()) : null;
    }

    private void sleep() {
        try {
            Thread.sleep(500L);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("领星同步等待被中断", ex);
        }
    }

    public record ActualSyncResult(int shipmentsFetched, int rowsWritten, int pages,
                                    Set<String> seqs) {
    }
}
