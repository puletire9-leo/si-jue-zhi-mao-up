package com.sjzm.product.modules.lingxing.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.toolkit.Db;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.sjzm.product.mapper.LingxingLocalProductMapper;
import com.sjzm.product.modules.lingxing.entity.LingxingLocalProduct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 领星本地产品同步服务。
 *
 * 手动触发：分页拉取 productList（offset/length，单页上限 1000）→ 字段映射 →
 * 按 lingxing_id 幂等 upsert 落库（双写：业务列 + raw_json 整包）。
 *
 * 幂等策略（张总蓝本 §一.2）：先按 lingxing_id 查库命中回填 id → saveOrUpdate，
 * 反复同步只更新不堆积、天然可重跑。分页翻页间预防式限流 sleep（productList 令牌桶容量 1）。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LingxingLocalProductSyncService {

    private static final String PRODUCT_LIST_PATH = "/erp/sc/routing/data/local_inventory/productList";
    private static final int PAGE_SIZE = 1000;          // 领星单页上限
    private static final int MAX_PAGES = 1000;          // 防御性上限（100 万条）
    private static final long PAGE_INTERVAL_MS = 500L;  // 预防式限流：翻页间隔
    private static final int DB_BATCH_SIZE = 500;

    private final LingxingClient client;
    private final LingxingLocalProductMapper productMapper;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * 全量同步领星本地产品。
     *
     * @return 同步结果统计 {pages, fetched, upserted}
     */
    public Map<String, Object> syncAll() {
        int offset = 0;
        int pages = 0;
        int fetched = 0;
        int upserted = 0;

        for (int p = 0; p < MAX_PAGES; p++) {
            ObjectNode body = objectMapper.createObjectNode();
            body.put("offset", offset);
            body.put("length", PAGE_SIZE);

            JsonNode resp = client.post(PRODUCT_LIST_PATH, body);
            JsonNode data = resp.path("data");
            if (!data.isArray() || data.isEmpty()) break;

            pages++;
            List<LingxingLocalProduct> pageEntities = new ArrayList<>(data.size());
            for (JsonNode row : data) {
                LingxingLocalProduct e = mapRow(row);
                if (e.getLingxingId() == null) {
                    log.warn("领星本地产品缺 id，跳过: {}", row);
                    continue;
                }
                // 幂等：按 lingxing_id 查存在 → 命中回填 id，saveOrUpdate 走更新
                LingxingLocalProduct existing = productMapper.selectOne(
                        new LambdaQueryWrapper<LingxingLocalProduct>()
                                .eq(LingxingLocalProduct::getLingxingId, e.getLingxingId())
                                .last("LIMIT 1"));
                if (existing != null) e.setId(existing.getId());
                pageEntities.add(e);
            }
            if (!pageEntities.isEmpty()) {
                Db.saveOrUpdateBatch(pageEntities, DB_BATCH_SIZE);
                upserted += pageEntities.size();
            }
            fetched += data.size();

            if (data.size() < PAGE_SIZE) break;   // 末页
            offset += PAGE_SIZE;
            sleep(PAGE_INTERVAL_MS);
        }

        log.info("领星本地产品同步完成：{} 页 / 拉取 {} 条 / upsert {} 条", pages, fetched, upserted);
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("pages", pages);
        r.put("fetched", fetched);
        r.put("upserted", upserted);
        return r;
    }

    // ============================================================
    // 写回领星：添加/编辑本地产品 + 上传图片
    // ============================================================

    private static final String PRODUCT_SET_PATH = "/erp/sc/routing/storage/product/set";
    private static final String UPLOAD_PIC_PATH = "/erp/sc/routing/storage/product/uploadPictures";

    /**
     * 添加/编辑本地产品（写回领星 productSet，令牌桶 10）。
     *
     * 领星该接口 60+ 参数且持续演进，这里做「忠实透传」：调用方按领星文档组织 body，
     * 后端只校验 sku 必填，不做有损的固定字段映射（避免漏字段/曲解语义）。
     * 写回成功后按 sku 回拉该产品刷新本地表，保持库内与领星一致。
     *
     * @param body 领星 productSet 请求体（至少含 sku；新增时还需 product_name）
     * @return {product_id, sku, sku_identifier, resynced}
     */
    public Map<String, Object> setProduct(JsonNode body) {
        if (body == null || !body.isObject()) {
            throw new IllegalArgumentException("请求体不能为空");
        }
        String sku = body.path("sku").asText("");
        if (sku.isBlank()) {
            throw new IllegalArgumentException("sku 必填");
        }

        JsonNode resp = client.post(PRODUCT_SET_PATH, body);
        JsonNode data = resp.path("data");

        Map<String, Object> r = new LinkedHashMap<>();
        r.put("product_id", data.path("product_id").asLong(0));
        r.put("sku", data.path("sku").asText(sku));
        r.put("sku_identifier", data.path("sku_identifier").asText(""));

        // 写回成功后回拉该 SKU，刷新本地表（幂等 upsert）
        int resynced = resyncBySku(sku);
        r.put("resynced", resynced);
        return r;
    }

    /**
     * 上传本地产品图片（写回领星 uploadPictures，令牌桶 1）。
     *
     * @param sku          本地产品 SKU（必填）
     * @param pictureList  图片数组 [{"pic_url":"...","is_primary":1}]（必填）
     * @return 领星返回 data
     */
    public JsonNode uploadPictures(String sku, JsonNode pictureList) {
        if (sku == null || sku.isBlank()) {
            throw new IllegalArgumentException("sku 必填");
        }
        if (pictureList == null || !pictureList.isArray() || pictureList.isEmpty()) {
            throw new IllegalArgumentException("picture_list 必填且不能为空");
        }
        ObjectNode body = objectMapper.createObjectNode();
        body.put("sku", sku);
        body.set("picture_list", pictureList);
        JsonNode resp = client.post(UPLOAD_PIC_PATH, body);
        resyncBySku(sku);
        return resp.path("data");
    }

    /** 按 SKU 回拉单个产品刷新本地表（用 productList + sku_list 过滤）。返回刷新条数。 */
    private int resyncBySku(String sku) {
        try {
            ObjectNode body = objectMapper.createObjectNode();
            body.put("offset", 0);
            body.put("length", PAGE_SIZE);
            body.putArray("sku_list").add(sku);
            JsonNode resp = client.post(PRODUCT_LIST_PATH, body);
            JsonNode data = resp.path("data");
            if (!data.isArray() || data.isEmpty()) return 0;

            List<LingxingLocalProduct> entities = new ArrayList<>();
            for (JsonNode row : data) {
                LingxingLocalProduct e = mapRow(row);
                if (e.getLingxingId() == null) continue;
                LingxingLocalProduct existing = productMapper.selectOne(
                        new LambdaQueryWrapper<LingxingLocalProduct>()
                                .eq(LingxingLocalProduct::getLingxingId, e.getLingxingId())
                                .last("LIMIT 1"));
                if (existing != null) e.setId(existing.getId());
                entities.add(e);
            }
            if (!entities.isEmpty()) Db.saveOrUpdateBatch(entities, DB_BATCH_SIZE);
            return entities.size();
        } catch (Exception ex) {
            // 回拉失败不影响写回结果（领星侧已改成功），仅记日志
            log.warn("领星产品写回后按 SKU {} 回拉刷新失败: {}", sku, ex.getMessage());
            return 0;
        }
    }

    /** 把领星 productList 单行映射为实体（业务列 + raw_json 整包留底）。 */
    private LingxingLocalProduct mapRow(JsonNode row) {
        LingxingLocalProduct e = new LingxingLocalProduct();
        e.setLingxingId(asLong(row, "id"));
        e.setSku(asText(row, "sku"));
        e.setSkuIdentifier(asText(row, "sku_identifier"));
        e.setProductName(asText(row, "product_name"));
        e.setCid(asLong(row, "cid"));
        e.setCategoryName(asText(row, "category_name"));
        e.setBid(asLong(row, "bid"));
        e.setBrandName(asText(row, "brand_name"));
        e.setPicUrl(asText(row, "pic_url"));
        e.setPsId(asLong(row, "ps_id"));
        e.setSpu(asText(row, "spu"));
        e.setCgPrice(asDecimal(row, "cg_price"));
        e.setCgDelivery(asInt(row, "cg_delivery"));
        e.setCgTransportCosts(asDecimal(row, "cg_transport_costs"));
        e.setPurchaseRemark(asText(row, "purchase_remark"));
        e.setStatus(asInt(row, "status"));
        e.setStatusText(asText(row, "status_text"));
        e.setOpenStatus(asInt(row, "open_status"));
        e.setIsCombo(asInt(row, "is_combo"));
        e.setProductDeveloperUid(asText(row, "product_developer_uid"));
        e.setProductDeveloper(asText(row, "product_developer"));
        e.setCgOptUid(asText(row, "cg_opt_uid"));
        e.setCgOptUsername(asText(row, "cg_opt_username"));
        e.setLxCreateTime(asDateTime(row, "create_time"));
        e.setLxUpdateTime(asDateTime(row, "update_time"));
        e.setRawJson(row.toString());
        e.setSyncedAt(LocalDateTime.now());
        return e;
    }

    // ---------- 取值工具（领星空值可能是 ""/0/缺字段，统一容错） ----------

    private String asText(JsonNode row, String key) {
        JsonNode n = row.path(key);
        if (n.isMissingNode() || n.isNull()) return null;
        String v = n.asText("");
        return v.isEmpty() ? null : v;
    }

    private Long asLong(JsonNode row, String key) {
        JsonNode n = row.path(key);
        if (n.isMissingNode() || n.isNull()) return null;
        if (n.isNumber()) return n.asLong();
        String v = n.asText("").trim();
        if (v.isEmpty()) return null;
        try {
            return Long.parseLong(v);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private Integer asInt(JsonNode row, String key) {
        Long v = asLong(row, key);
        return v == null ? null : v.intValue();
    }

    private BigDecimal asDecimal(JsonNode row, String key) {
        JsonNode n = row.path(key);
        if (n.isMissingNode() || n.isNull()) return null;
        String v = n.asText("").trim();
        if (v.isEmpty()) return null;
        try {
            return new BigDecimal(v);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    /** 领星 create_time/update_time 是秒级时间戳；0/空视为无值。 */
    private LocalDateTime asDateTime(JsonNode row, String key) {
        Long ts = asLong(row, key);
        if (ts == null || ts <= 0) return null;
        return LocalDateTime.ofInstant(Instant.ofEpochSecond(ts), ZoneId.systemDefault());
    }

    private void sleep(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
