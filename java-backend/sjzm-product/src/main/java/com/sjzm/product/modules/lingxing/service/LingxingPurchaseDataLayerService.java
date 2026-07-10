package com.sjzm.product.modules.lingxing.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.sjzm.product.mapper.LingxingPurchaseDataLayerMapper;
import com.sjzm.product.mapper.LingxingSkuDataLayerMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Syncs Lingxing purchase plans and purchase orders into normalized fact tables.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LingxingPurchaseDataLayerService {

    private static final String PLAN_PATH = "/erp/sc/routing/data/local_inventory/getPurchasePlans";
    private static final String ORDER_PATH = "/erp/sc/routing/data/local_inventory/purchaseOrderList";
    private static final DateTimeFormatter RUN_TIME = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
    private static final int PAGE_SIZE = 500;
    private static final int MAX_PAGES = 1000;

    private final LingxingClient client;
    private final LingxingPurchaseDataLayerMapper purchaseMapper;
    private final LingxingSkuDataLayerMapper runMapper;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> syncPurchasePlans(String startDate,
                                                 String endDate,
                                                 String searchFieldTime,
                                                 List<String> planSns,
                                                 List<Integer> statuses,
                                                 List<Long> sids) {
        String runId = runId("purchase-plan");
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("path", PLAN_PATH);
        request.put("startDate", safe(startDate));
        request.put("endDate", safe(endDate));
        request.put("searchFieldTime", defaultText(searchFieldTime, "creator_time"));
        request.put("planSns", planSns == null ? List.of() : planSns);
        request.put("statuses", statuses == null ? List.of() : statuses);
        request.put("sids", sids == null ? List.of() : sids);

        int fetched = 0;
        int upserted = 0;
        int pages = 0;
        runMapper.beginRun(runId, "PURCHASE_PLAN", "ALL", dateOnly(startDate), dateOnly(endDate),
                null, null, json(request));
        try {
            for (int offset = 0; pages < MAX_PAGES; offset += PAGE_SIZE) {
                ObjectNode body = objectMapper.createObjectNode();
                body.put("search_field_time", defaultText(searchFieldTime, "creator_time"));
                body.put("start_date", startDate);
                body.put("end_date", endDate);
                body.put("offset", offset);
                body.put("length", PAGE_SIZE);
                addStringArray(body, "plan_sns", planSns);
                addIntArray(body, "status", statuses);
                addLongArray(body, "sids", sids);

                JsonNode resp = client.post(PLAN_PATH, body);
                JsonNode data = resp.path("data");
                if (!data.isArray() || data.isEmpty()) break;

                pages++;
                fetched += data.size();
                for (JsonNode row : data) {
                    purchaseMapper.upsertPurchasePlan(mapPlan(row), runId);
                    upserted++;
                }
                if (data.size() < PAGE_SIZE) break;
                sleep(1_000L);
            }
            runMapper.finishRun(runId, "SUCCESS", upserted, null);
        } catch (RuntimeException ex) {
            runMapper.finishRun(runId, "FAILED", upserted, ex.getMessage());
            throw ex;
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("runId", runId);
        result.put("pages", pages);
        result.put("fetched", fetched);
        result.put("upserted", upserted);
        result.put("stats", purchaseMapper.stats());
        return result;
    }

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> syncPurchaseOrders(String startDate,
                                                  String endDate,
                                                  String searchFieldTime,
                                                  List<String> orderSns,
                                                  List<String> customOrderSns,
                                                  Integer purchaseType) {
        String runId = runId("purchase-order");
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("path", ORDER_PATH);
        request.put("startDate", safe(startDate));
        request.put("endDate", safe(endDate));
        request.put("searchFieldTime", defaultText(searchFieldTime, "create_time"));
        request.put("orderSns", orderSns == null ? List.of() : orderSns);
        request.put("customOrderSns", customOrderSns == null ? List.of() : customOrderSns);
        request.put("purchaseType", purchaseType == null ? "" : purchaseType);

        int fetchedOrders = 0;
        int upsertedOrders = 0;
        int upsertedItems = 0;
        int pages = 0;
        runMapper.beginRun(runId, "PURCHASE_ORDER", "ALL", dateOnly(startDate), dateOnly(endDate),
                null, null, json(request));
        try {
            for (int offset = 0; pages < MAX_PAGES; offset += PAGE_SIZE) {
                ObjectNode body = objectMapper.createObjectNode();
                body.put("search_field_time", defaultText(searchFieldTime, "create_time"));
                body.put("start_date", startDate);
                body.put("end_date", endDate);
                body.put("offset", offset);
                body.put("length", PAGE_SIZE);
                addStringArray(body, "order_sn", orderSns);
                addStringArray(body, "custom_order_sn", customOrderSns);
                if (purchaseType != null) body.put("purchase_type", purchaseType);

                JsonNode resp = client.post(ORDER_PATH, body);
                JsonNode data = resp.path("data");
                if (!data.isArray() || data.isEmpty()) break;

                pages++;
                fetchedOrders += data.size();
                for (JsonNode order : data) {
                    Map<String, Object> orderRow = mapOrder(order);
                    purchaseMapper.upsertPurchaseOrder(orderRow, runId);
                    upsertedOrders++;
                    JsonNode items = order.path("item_list");
                    if (items.isArray()) {
                        for (JsonNode item : items) {
                            purchaseMapper.upsertPurchaseOrderItem(mapOrderItem(order, item), runId);
                            upsertedItems++;
                        }
                    }
                }
                if (data.size() < PAGE_SIZE) break;
                sleep(1_000L);
            }
            runMapper.finishRun(runId, "SUCCESS", upsertedOrders + upsertedItems, null);
        } catch (RuntimeException ex) {
            runMapper.finishRun(runId, "FAILED", upsertedOrders + upsertedItems, ex.getMessage());
            throw ex;
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("runId", runId);
        result.put("pages", pages);
        result.put("fetchedOrders", fetchedOrders);
        result.put("upsertedOrders", upsertedOrders);
        result.put("upsertedItems", upsertedItems);
        result.put("stats", purchaseMapper.stats());
        return result;
    }

    public Map<String, Object> stats() {
        return Map.of("stats", purchaseMapper.stats());
    }

    private Map<String, Object> mapPlan(JsonNode row) {
        Map<String, Object> out = new LinkedHashMap<>();
        put(out, "planSn", text(row, "plan_sn"));
        put(out, "ppgSn", text(row, "ppg_sn"));
        put(out, "status", intValue(row, "status"));
        put(out, "statusText", text(row, "status_text"));
        put(out, "sku", text(row, "sku"));
        put(out, "productId", longValue(row, "product_id"));
        put(out, "productName", text(row, "product_name"));
        put(out, "spu", text(row, "spu"));
        put(out, "spuName", text(row, "spu_name"));
        put(out, "sid", longValue(row, "sid"));
        put(out, "sellerName", text(row, "seller_name"));
        put(out, "marketplaceRaw", text(row, "marketplace"));
        put(out, "fnsku", text(row, "fnsku"));
        put(out, "mskuJson", jsonNode(row.path("msku")));
        put(out, "supplierId", longValue(row, "supplier_id"));
        put(out, "supplierName", text(row, "supplier_name"));
        put(out, "wid", longValue(row, "wid"));
        put(out, "warehouseName", text(row, "warehouse_name"));
        put(out, "purchaserId", longValue(row, "purchaser_id"));
        put(out, "purchaserName", text(row, "purchaser_name"));
        put(out, "cgBoxPcs", intValue(row, "cg_box_pcs"));
        put(out, "quantityPlan", intValue(row, "quantity_plan"));
        put(out, "expectArriveTime", text(row, "expect_arrive_time"));
        put(out, "createTime", text(row, "create_time"));
        put(out, "creatorUid", longValue(row, "creator_uid"));
        put(out, "creatorRealName", text(row, "creator_real_name"));
        put(out, "cgUid", longValue(row, "cg_uid"));
        put(out, "cgOptUsername", text(row, "cg_opt_username"));
        put(out, "remark", text(row, "remark"));
        put(out, "planRemark", text(row, "plan_remark"));
        put(out, "isCombo", intValue(row, "is_combo"));
        put(out, "isAux", intValue(row, "is_aux"));
        put(out, "isRelatedProcessPlan", intValue(row, "is_related_process_plan"));
        put(out, "attributeJson", jsonNode(row.path("attribute")));
        put(out, "fileJson", jsonNode(row.path("file")));
        put(out, "permUidJson", jsonNode(row.path("perm_uid")));
        put(out, "permUsernameJson", jsonNode(row.path("perm_username")));
        put(out, "rawJson", row.toString());
        return out;
    }

    private Map<String, Object> mapOrder(JsonNode row) {
        Map<String, Object> out = new LinkedHashMap<>();
        put(out, "orderSn", text(row, "order_sn"));
        put(out, "customOrderSn", text(row, "custom_order_sn"));
        put(out, "supplierId", longValue(row, "supplier_id"));
        put(out, "supplierName", text(row, "supplier_name"));
        put(out, "optUid", longValue(row, "opt_uid"));
        put(out, "optRealname", text(row, "opt_realname"));
        put(out, "lastUid", longValue(row, "last_uid"));
        put(out, "lastRealname", text(row, "last_realname"));
        put(out, "auditorUid", longValue(row, "auditor_uid"));
        put(out, "auditorRealname", text(row, "auditor_realname"));
        put(out, "createTime", text(row, "create_time"));
        put(out, "orderTime", text(row, "order_time"));
        put(out, "auditorTime", text(row, "auditor_time"));
        put(out, "lastTime", text(row, "last_time"));
        put(out, "updateTime", text(row, "update_time"));
        put(out, "status", intValue(row, "status"));
        put(out, "statusText", text(row, "status_text"));
        put(out, "statusShipped", intValue(row, "status_shipped"));
        put(out, "statusShippedText", text(row, "status_shipped_text"));
        put(out, "payStatus", intValue(row, "pay_status"));
        put(out, "payStatusText", text(row, "pay_status_text"));
        put(out, "purchaseType", text(row, "purchase_type"));
        put(out, "purchaseTypeText", text(row, "purchase_type_text"));
        put(out, "purchaseCurrency", text(row, "purchase_currency"));
        put(out, "purchaseRate", decimalText(row, "purchase_rate"));
        put(out, "amountTotal", decimalText(row, "amount_total"));
        put(out, "totalPrice", decimalText(row, "total_price"));
        put(out, "payment", decimalText(row, "payment"));
        put(out, "otherFee", decimalText(row, "other_fee"));
        put(out, "shippingPrice", decimalText(row, "shipping_price"));
        put(out, "quantityTotal", intValue(row, "quantity_total"));
        put(out, "quantityReal", intValue(row, "quantity_real"));
        put(out, "quantityEntry", intValue(row, "quantity_entry"));
        put(out, "quantityReceive", intValue(row, "quantity_receive"));
        put(out, "wid", longValue(row, "wid"));
        put(out, "wareHouseName", text(row, "ware_house_name"));
        put(out, "wareHouseBakName", text(row, "ware_house_bak_name"));
        put(out, "purchaserId", longValue(row, "purchaser_id"));
        put(out, "settlementMethod", intValue(row, "settlement_method"));
        put(out, "settlementDescription", text(row, "settlement_description"));
        put(out, "remark", text(row, "remark"));
        put(out, "reason", text(row, "reason"));
        put(out, "principalUidsJson", jsonNode(row.path("principal_uids")));
        put(out, "customFieldsJson", jsonNode(row.path("custom_fields")));
        put(out, "logisticsInfoJson", jsonNode(row.path("logistics_info")));
        put(out, "rawJson", row.toString());
        return out;
    }

    private Map<String, Object> mapOrderItem(JsonNode order, JsonNode item) {
        Map<String, Object> out = new LinkedHashMap<>();
        put(out, "orderSn", text(order, "order_sn"));
        put(out, "customOrderSn", text(order, "custom_order_sn"));
        put(out, "itemId", longValue(item, "id"));
        put(out, "planSn", text(item, "plan_sn"));
        put(out, "relationPurchasePlanJson", jsonNode(item.path("relation_purchase_plan")));
        put(out, "productId", longValue(item, "product_id"));
        put(out, "productName", text(item, "product_name"));
        put(out, "sku", text(item, "sku"));
        put(out, "fnsku", text(item, "fnsku"));
        put(out, "sid", longValue(item, "sid"));
        put(out, "mskuJson", jsonNode(item.path("msku")));
        put(out, "wid", longValue(item, "wid"));
        put(out, "wareHouseName", text(item, "ware_house_name"));
        put(out, "model", text(item, "model"));
        put(out, "price", decimalText(item, "price"));
        put(out, "amount", decimalText(item, "amount"));
        put(out, "quantityPlan", intValue(item, "quantity_plan"));
        put(out, "quantityReal", intValue(item, "quantity_real"));
        put(out, "quantityEntry", intValue(item, "quantity_entry"));
        put(out, "quantityReceive", intValue(item, "quantity_receive"));
        put(out, "quantityReturn", intValue(item, "quantity_return"));
        put(out, "quantityExchange", intValue(item, "quantity_exchange"));
        put(out, "quantityQc", intValue(item, "quantity_qc"));
        put(out, "quantityQcPrepare", intValue(item, "quantity_qc_prepare"));
        put(out, "expectArriveTime", text(item, "expect_arrive_time"));
        put(out, "casesNum", intValue(item, "cases_num"));
        put(out, "quantityPerCase", intValue(item, "quantity_per_case"));
        put(out, "isDelete", intValue(item, "is_delete"));
        put(out, "spu", text(item, "spu"));
        put(out, "spuName", text(item, "spu_name"));
        put(out, "attributeJson", jsonNode(item.path("attribute")));
        put(out, "customFieldsJson", jsonNode(item.path("custom_fields")));
        put(out, "remark", text(item, "remark"));
        put(out, "rawJson", item.toString());
        return out;
    }

    private void addStringArray(ObjectNode body, String field, List<String> values) {
        if (values == null || values.isEmpty()) return;
        ArrayNode arr = body.putArray(field);
        values.stream().filter(StringUtils::hasText).forEach(arr::add);
    }

    private void addIntArray(ObjectNode body, String field, List<Integer> values) {
        if (values == null || values.isEmpty()) return;
        ArrayNode arr = body.putArray(field);
        values.forEach(arr::add);
    }

    private void addLongArray(ObjectNode body, String field, List<Long> values) {
        if (values == null || values.isEmpty()) return;
        ArrayNode arr = body.putArray(field);
        values.forEach(arr::add);
    }

    private void put(Map<String, Object> map, String key, Object value) {
        map.put(key, value);
    }

    private String text(JsonNode node, String field) {
        JsonNode value = node.path(field);
        if (value.isMissingNode() || value.isNull()) return null;
        String text = value.asText("");
        if (text == null) return null;
        String trimmed = text.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String decimalText(JsonNode node, String field) {
        String text = text(node, field);
        if (!StringUtils.hasText(text)) return null;
        return text;
    }

    private Integer intValue(JsonNode node, String field) {
        String text = text(node, field);
        if (!StringUtils.hasText(text)) return null;
        try {
            return (int) Double.parseDouble(text);
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private Long longValue(JsonNode node, String field) {
        String text = text(node, field);
        if (!StringUtils.hasText(text)) return null;
        try {
            return (long) Double.parseDouble(text);
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private String jsonNode(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) return null;
        return node.toString();
    }

    private String json(Map<String, ?> data) {
        try {
            return objectMapper.writeValueAsString(data);
        } catch (JsonProcessingException ex) {
            return "{}";
        }
    }

    private String runId(String prefix) {
        return prefix + "-" + LocalDateTime.now().format(RUN_TIME);
    }

    private String defaultText(String value, String defaultValue) {
        return StringUtils.hasText(value) ? value.trim() : defaultValue;
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }

    private String dateOnly(String value) {
        if (!StringUtils.hasText(value)) return null;
        String text = value.trim();
        return text.length() >= 10 ? text.substring(0, 10) : text;
    }

    private void sleep(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("采购同步被中断", ex);
        }
    }
}
