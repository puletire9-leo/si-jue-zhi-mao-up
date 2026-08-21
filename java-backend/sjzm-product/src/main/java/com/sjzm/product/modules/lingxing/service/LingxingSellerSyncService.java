package com.sjzm.product.modules.lingxing.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.sjzm.product.mapper.LingxingSellerMapper;
import com.sjzm.product.modules.lingxing.entity.LingxingSeller;
import com.sjzm.product.rds.service.RdsBatchWriteService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 领星亚马逊店铺同步服务。
 *
 * 手动触发：GET /erp/sc/data/seller/lists 一次性返回企业全部已授权店铺 →
 * 按 sid 幂等 upsert 落库（双写：业务列 + raw_json 整包）。
 *
 * 本表是产品表现 / ASIN 360 小时 / 利润统计等按店铺维度取数的 sid 来源。
 * 该接口无分页、无入参，令牌桶容量 1。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LingxingSellerSyncService {

    private static final String SELLER_LIST_PATH = "/erp/sc/data/seller/lists";
    private static final int DB_BATCH_SIZE = 500;

    private final LingxingClient client;
    private final LingxingSellerMapper sellerMapper;
    private final RdsBatchWriteService rdsBatchWriteService;

    /**
     * 全量同步领星亚马逊店铺。
     *
     * @return 同步结果统计 {fetched, upserted}
     */
    public Map<String, Object> syncAll() {
        // 该接口为 GET，无业务入参
        JsonNode resp = client.get(SELLER_LIST_PATH, null);
        JsonNode data = resp.path("data");

        List<LingxingSeller> entities = new ArrayList<>();
        if (data.isArray()) {
            for (JsonNode row : data) {
                LingxingSeller entity = mapRow(row);
                if (entity.getSid() == null) {
                    log.warn("领星店铺缺 sid，跳过: {}", row);
                    continue;
                }
                entities.add(entity);
            }
        }

        if (!entities.isEmpty()) {
            Map<Long, Long> existingIds = sellerMapper.selectList(
                            new LambdaQueryWrapper<LingxingSeller>()
                                    .select(LingxingSeller::getId, LingxingSeller::getSid)
                                    .in(LingxingSeller::getSid,
                                            entities.stream().map(LingxingSeller::getSid).toList()))
                    .stream().collect(Collectors.toMap(
                            LingxingSeller::getSid, LingxingSeller::getId,
                            (left, right) -> left));
            entities.forEach(entity -> entity.setId(existingIds.get(entity.getSid())));
        }

        int upserted = 0;
        if (!entities.isEmpty()) {
            upserted = rdsBatchWriteService.saveOrUpdate(
                    LingxingSellerMapper.class, entities, DB_BATCH_SIZE,
                    entity -> entity.getId() != null);
        }

        int fetched = data.isArray() ? data.size() : 0;
        log.info("领星店铺同步完成：拉取 {} 条 / upsert {} 条", fetched, upserted);
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("fetched", fetched);
        r.put("upserted", upserted);
        return r;
    }

    /** 把领星 seller/lists 单行映射为实体（业务列 + raw_json 整包留底）。 */
    private LingxingSeller mapRow(JsonNode row) {
        LingxingSeller e = new LingxingSeller();
        e.setSid(asLong(row, "sid"));
        e.setMid(asLong(row, "mid"));
        e.setName(asText(row, "name"));
        e.setSellerId(asText(row, "seller_id"));
        e.setAccountName(asText(row, "account_name"));
        e.setSellerAccountId(asLong(row, "seller_account_id"));
        e.setRegion(asText(row, "region"));
        e.setCountry(asText(row, "country"));
        e.setHasAdsSetting(asInt(row, "has_ads_setting"));
        e.setMarketplaceId(asText(row, "marketplace_id"));
        e.setStatus(asInt(row, "status"));
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
}
