package com.sjzm.product.modules.lingxing.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.toolkit.Db;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.sjzm.product.mapper.LingxingListingFbaFeeMapper;
import com.sjzm.product.modules.lingxing.entity.LingxingListingFbaFee;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 领星 Listing FBA 预估费同步（getPrices 接口）。
 *
 * <p>接口 {@code /listing/listing/open/api/listing/getPrices}，POST，令牌桶 10，
 * 入参 data[]（≤500），每项 {sid, msku}；返回 fba_fee / fba_fee_report / fba_fee_currency_code。
 * 落库 lingxing_listing_fba_fee（唯一键 sid+msku），供 FBA 费对比表 JOIN。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LingxingListingFeeService {

    private static final String PATH = "/listing/listing/open/api/listing/getPrices";
    private static final int BATCH = 500;          // data 上限 500
    private static final long BATCH_INTERVAL_MS = 300L; // 令牌桶 10，批间小间隔预防
    private static final int DB_BATCH = 500;

    private final LingxingClient client;
    private final LingxingListingFbaFeeMapper feeMapper;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * 按 sid+msku 列表批量拉 FBA 预估费落库。
     *
     * @param sidMskus 每项含 sid、msku（通常来自合格 ASIN 对应的 listing 行）
     * @return {requested, fetched, upserted}
     */
    public Map<String, Object> syncFees(List<Map<String, Object>> sidMskus) {
        int fetched = 0;
        int upserted = 0;
        for (int i = 0; i < sidMskus.size(); i += BATCH) {
            List<Map<String, Object>> batch = sidMskus.subList(i, Math.min(i + BATCH, sidMskus.size()));
            ObjectNode body = objectMapper.createObjectNode();
            ArrayNode data = body.putArray("data");
            for (Map<String, Object> item : batch) {
                Object sid = item.get("sid");
                Object msku = item.get("msku");
                if (sid == null || msku == null) continue;
                ObjectNode one = data.addObject();
                one.put("sid", Long.parseLong(String.valueOf(sid)));
                one.put("msku", String.valueOf(msku));
            }
            JsonNode resp = client.post(PATH, body);
            JsonNode arr = resp.path("data");
            if (!arr.isArray()) {
                log.warn("领星 getPrices 返回 data 非数组，跳过本批: {}", resp);
                continue;
            }
            List<LingxingListingFbaFee> entities = new ArrayList<>();
            for (JsonNode row : arr) {
                Long sid = row.path("sid").asLong(0);
                String msku = row.path("msku").asText("");
                if (sid == 0 || msku.isEmpty()) continue;
                fetched++;
                LingxingListingFbaFee e = new LingxingListingFbaFee();
                e.setSid(sid);
                e.setMsku(msku);
                e.setFbaFee(asDecimal(row, "fba_fee"));
                e.setFbaFeeReport(asDecimal(row, "fba_fee_report"));
                e.setFeeCurrency(row.path("fba_fee_currency_code").asText(null));
                e.setSyncedAt(LocalDateTime.now());
                // 幂等：按 sid+msku 命中回填 id
                LingxingListingFbaFee existing = feeMapper.selectOne(
                        new LambdaQueryWrapper<LingxingListingFbaFee>()
                                .eq(LingxingListingFbaFee::getSid, sid)
                                .eq(LingxingListingFbaFee::getMsku, msku)
                                .last("LIMIT 1"));
                if (existing != null) e.setId(existing.getId());
                entities.add(e);
            }
            if (!entities.isEmpty()) {
                Db.saveOrUpdateBatch(entities, DB_BATCH);
                upserted += entities.size();
            }
            sleep(BATCH_INTERVAL_MS);
        }
        log.info("领星 FBA 预估费同步：请求 {} 项 / 返回 {} / upsert {}", sidMskus.size(), fetched, upserted);
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("requested", sidMskus.size());
        r.put("fetched", fetched);
        r.put("upserted", upserted);
        return r;
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

    private void sleep(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
