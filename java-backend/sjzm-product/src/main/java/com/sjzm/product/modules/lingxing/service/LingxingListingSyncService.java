package com.sjzm.product.modules.lingxing.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.toolkit.Db;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.sjzm.product.mapper.LingxingListingMapper;
import com.sjzm.product.modules.lingxing.entity.LingxingListing;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 领星亚马逊 Listing 同步服务。
 *
 * <p>手动触发：分页拉取 {@code /erp/sc/data/mws/listing}（POST，分页 ≤1000/页）→
 * 字段映射 → 按 {@code sid + seller_sku}（API 文档明示唯一键）幂等 upsert 落库（双写：业务列 + raw_json）。</p>
 *
 * <p><b>限流铁律</b>：该接口令牌桶容量 1，必须严格串行（等同卖家精灵铁律）。
 * 翻页用 {@link #PAGE_INTERVAL_MS} sleep 间隔，且单线程同步处理，绝不并发。</p>
 *
 * <p>幂等策略（张总蓝本 §一.2）：先按 sid+seller_sku 查库命中回填 id → saveOrUpdate，
 * 反复同步只更新不堆积、天然可重跑。</p>
 *
 * <p>时间解析要点（API 文档核实）：
 * <ul>
 *   <li>{@code open_date}：带本地时区描述，如 {@code 2021-02-04 01:15:58 PST} 或 {@code ... -08:00}，
 *       解析为 UTC 后落 DATETIME。</li>
 *   <li>{@code listing_update_date}：零时区（UTC）。</li>
 *   <li>{@code pair_update_time}：北京时间，按 UTC+8 解析后落 UTC。</li>
 *   <li>{@code first_order_time / on_sale_time}：Y-m-d 纯日期。</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LingxingListingSyncService {

    private static final String PATH = "/erp/sc/data/mws/listing";
    private static final int PAGE_SIZE = 1000;          // 领星单页上限
    private static final int MAX_PAGES = 5000;          // 防御性上限（500 万条）
    private static final long PAGE_INTERVAL_MS = 500L;   // 令牌桶=1，预防式翻页间隔
    private static final int DB_BATCH_SIZE = 500;

    private final LingxingClient client;
    private final LingxingListingMapper listingMapper;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * 同步领星 Listing。
     *
     * @param sids          店铺 id 列表（API 要求 sid 逗号分隔，这里逐个串行调用更稳；
     *                      空则报错——listing 接口 sid 必填）
     * @param isPair        是否配对：1 已配对 / 2 未配对（null 不过滤）
     * @param isDelete      是否删除：0 未删 / 1 已删（null 不过滤）
     * @param listingUpdateStart  All Listing 报表更新时间起（零时区，Y-m-d H:i:s）
     * @param listingUpdateEnd    All Listing 报表更新时间止（零时区）
     * @param searchField   搜索字段：seller_sku / asin / sku（可空）
     * @param searchValues  搜索值，上限 10（可空）
     * @param exactSearch   0 模糊 / 1 精确（默认 1）
     * @return 同步结果统计 {storeCount, pages, fetched, upserted}
     */
    public Map<String, Object> sync(List<Integer> sids,
                                    Integer isPair,
                                    Integer isDelete,
                                    String listingUpdateStart,
                                    String listingUpdateEnd,
                                    String searchField,
                                    List<String> searchValues,
                                    Integer exactSearch) {
        if (sids == null || sids.isEmpty()) {
            throw new IllegalArgumentException("sid 必填（listing 接口按店铺维度取数）");
        }

        int pages = 0;
        int fetched = 0;
        int upserted = 0;

        // 逐店铺串行调用——令牌桶=1，绝不可并发；同账户多 appId 也共享限流。
        for (Integer sid : sids) {
            int offset = 0;
            for (int p = 0; p < MAX_PAGES; p++) {
                ObjectNode body = objectMapper.createObjectNode();
                body.put("sid", String.valueOf(sid));
                body.put("offset", offset);
                body.put("length", PAGE_SIZE);
                if (isPair != null) body.put("is_pair", isPair);
                if (isDelete != null) body.put("is_delete", isDelete);
                if (StringUtils.hasText(listingUpdateStart)) body.put("listing_update_start_time", listingUpdateStart);
                if (StringUtils.hasText(listingUpdateEnd)) body.put("listing_update_end_time", listingUpdateEnd);
                if (StringUtils.hasText(searchField)) {
                    body.put("search_field", searchField);
                    if (searchValues != null && !searchValues.isEmpty()) {
                        body.set("search_value", objectMapper.valueToTree(searchValues));
                    }
                    body.put("exact_search", exactSearch == null ? 1 : exactSearch);
                }

                JsonNode resp = client.post(PATH, body);
                JsonNode data = resp.path("data");
                if (!data.isArray() || data.isEmpty()) break;

                pages++;
                List<LingxingListing> pageEntities = new ArrayList<>(data.size());
                for (JsonNode row : data) {
                    LingxingListing e = mapRow(row, sid);
                    if (e.getSid() == null || e.getSellerSku() == null) {
                        log.warn("领星 listing 缺 sid/seller_sku，跳过: sid={}, row={}", sid, row);
                        continue;
                    }
                    LingxingListing existing = listingMapper.selectOne(
                            new LambdaQueryWrapper<LingxingListing>()
                                    .eq(LingxingListing::getSid, e.getSid())
                                    .eq(LingxingListing::getSellerSku, e.getSellerSku())
                                    .last("LIMIT 1"));
                    if (existing != null) e.setId(existing.getId());
                    pageEntities.add(e);
                }
                if (!pageEntities.isEmpty()) {
                    Db.saveOrUpdateBatch(pageEntities, DB_BATCH_SIZE);
                    upserted += pageEntities.size();
                }
                fetched += data.size();

                if (data.size() < PAGE_SIZE) break;
                offset += PAGE_SIZE;
                sleep(PAGE_INTERVAL_MS);
            }
            log.info("领星 listing sid={} 同步完成：本店拉取结束", sid);
        }

        log.info("领星 listing 同步完成：{} 店 / {} 页 / 拉取 {} 条 / upsert {} 条",
                sids.size(), pages, fetched, upserted);
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("storeCount", sids.size());
        r.put("pages", pages);
        r.put("fetched", fetched);
        r.put("upserted", upserted);
        return r;
    }

    /** 把领星 listing 单行映射为实体（业务列 + raw_json 整包留底）。 */
    private LingxingListing mapRow(JsonNode row, Integer requestSid) {
        LingxingListing e = new LingxingListing();
        // sid 优先用响应里的，缺则用请求的
        Integer sid = asInt(row, "sid");
        e.setSid(sid != null ? sid : requestSid);
        e.setListingId(asText(row, "listing_id"));
        e.setMarketplace(asText(row, "marketplace"));
        e.setMid(asInt(row, "mid"));
        e.setSellerSku(asText(row, "seller_sku"));
        e.setFnsku(asText(row, "fnsku"));
        e.setAsin(asText(row, "asin"));
        e.setParentAsin(asText(row, "parent_asin"));
        e.setLocalSku(asText(row, "local_sku"));
        e.setLocalName(asText(row, "local_name"));
        e.setItemName(asText(row, "item_name"));
        e.setSmallImageUrl(asText(row, "small_image_url"));
        e.setStatus(asInt(row, "status"));
        e.setIsDelete(asInt(row, "is_delete"));
        e.setIsPair(asInt(row, "is_pair"));
        e.setCurrencyCode(asText(row, "currency_code"));
        e.setPrice(asDecimal(row, "price"));
        e.setLandedPrice(asDecimal(row, "landed_price"));
        e.setListingPrice(asDecimal(row, "listing_price"));
        e.setShipping(asDecimal(row, "shipping"));
        e.setPoints(asText(row, "points"));
        e.setQuantity(asInt(row, "quantity"));
        e.setAfnFulfillableQuantity(asInt(row, "afn_fulfillable_quantity"));
        e.setAfnUnsellableQuantity(asInt(row, "afn_unsellable_quantity"));
        e.setReservedFcTransfers(asInt(row, "reserved_fc_transfers"));
        e.setReservedFcProcessing(asInt(row, "reserved_fc_processing"));
        e.setReservedCustomerorders(asInt(row, "reserved_customerorders"));
        e.setAfnInboundShippedQuantity(asInt(row, "afn_inbound_shipped_quantity"));
        e.setAfnInboundWorkingQuantity(asInt(row, "afn_inbound_working_quantity"));
        e.setAfnInboundReceivingQuantity(asInt(row, "afn_inbound_receiving_quantity"));

        // 时间解析
        // 文档示例 open_date 是 "2021-02-04 01:15:58 PST" 缩写格式，但实测返回 dd/MM/yyyy + 缩写（如 "26/09/2018 09:56:40 MEST"）。
        // open_date_display 实测是工整带偏移 "2018-09-26 09:56:40 +03:00"，可稳定解析。
        // 故用 open_date_display 解析落 open_date 列（同一时刻的 UTC 表示）；open_date 原始值通过 display 列留底即可。
        e.setOpenDateDisplay(asText(row, "open_date_display"));
        e.setOpenDate(parseOpenDate(e.getOpenDateDisplay()));
        e.setListingUpdateDate(parseUtcDateTime(asText(row, "listing_update_date")));
        e.setPairUpdateTime(parseChinaTime(asText(row, "pair_update_time")));
        e.setFirstOrderTime(parseDate(asText(row, "first_order_time")));
        e.setOnSaleTime(parseDate(asText(row, "on_sale_time")));

        e.setSellerRank(asLong(row, "seller_rank"));
        e.setSellerBrand(asText(row, "seller_brand"));
        e.setSellerCategory(asText(row, "seller_category"));
        e.setSellerCategoryNew(asJsonString(row, "seller_category_new"));
        e.setReviewNum(asInt(row, "review_num"));
        e.setLastStar(asDecimal(row, "last_star"));
        e.setFulfillmentChannelType(asText(row, "fulfillment_channel_type"));
        e.setStoreType(asInt(row, "store_type"));

        // principal_info 是数组 [{principal_uid, principal_name}]，取第一个
        JsonNode principal = row.path("principal_info");
        if (principal.isArray() && principal.size() > 0) {
            JsonNode p0 = principal.get(0);
            e.setPrincipalUid(asText(p0, "principal_uid"));
            e.setPrincipalName(asText(p0, "principal_name"));
        }

        e.setTotalVolume(asInt(row, "total_volume"));
        e.setYesterdayVolume(asInt(row, "yesterday_volume"));
        e.setFourteenVolume(asInt(row, "fourteen_volume"));
        e.setThirtyVolume(asInt(row, "thirty_volume"));
        e.setYesterdayAmount(asDecimal(row, "yesterday_amount"));
        e.setSevenAmount(asDecimal(row, "seven_amount"));
        e.setFourteenAmount(asDecimal(row, "fourteen_amount"));
        e.setThirtyAmount(asDecimal(row, "thirty_amount"));
        e.setAverageSevenVolume(asInt(row, "average_seven_volume"));
        e.setAverageFourteenVolume(asInt(row, "average_fourteen_volume"));
        e.setAverageThirtyVolume(asInt(row, "average_thirty_volume"));

        e.setDimensionInfo(asJsonString(row, "dimension_info"));
        e.setSmallRank(asJsonString(row, "small_rank"));
        e.setGlobalTags(asJsonString(row, "global_tags"));
        e.setVariant(asJsonString(row, "variant"));

        e.setRawJson(row.toString());
        e.setSyncedAt(LocalDateTime.now());
        return e;
    }

    // ============================================================
    // 时间解析（领星多种时区格式）
    // ============================================================

    /** open_date 可能是 "2021-02-04 01:15:58 PST" 或 "2021-02-04 01:15:58 -08:00"。 */
    private LocalDateTime parseOpenDate(String s) {
        if (s == null || s.isBlank()) return null;
        String v = s.trim();
        try {
            // 优先尝试带偏移的格式（如 "2018-09-26 09:56:40 +03:00"，空格分隔）
            if (v.matches(".*[+-][0-9]{2}:[0-9]{2}$")) {
                // "yyyy-MM-dd HH:mm:ss +HH:MM" → "yyyy-MM-ddTHH:mm:ss+HH:MM"（去空格）后用 ISO 解析
                String iso = v.replaceFirst(" ", "T").replace(" ", "");
                ZonedDateTime zdt = ZonedDateTime.parse(iso, DateTimeFormatter.ISO_OFFSET_DATE_TIME);
                return zdt.withZoneSameInstant(ZoneId.of("UTC")).toLocalDateTime();
            }
            // 带时区缩写（PST/PDT/EST 等）——用预设时区名替换最常见几个
            String zoneId = guessZoneId(v);
            String core = v.replaceAll("\\s+[A-Z]{2,4}$", "");
            LocalDateTime ldt = LocalDateTime.parse(core, DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
            return ldt.atZone(zoneId != null ? ZoneId.of(zoneId) : ZoneId.of("America/Los_Angeles"))
                    .withZoneSameInstant(ZoneId.of("UTC")).toLocalDateTime();
        } catch (Exception ex) {
            log.warn("解析 open_date 失败，保留为空: {} ({})", v, ex.getMessage());
            return null;
        }
    }

    /** 零时区时间（listing_update_date）。 */
    private LocalDateTime parseUtcDateTime(String s) {
        if (s == null || s.isBlank()) return null;
        try {
            return LocalDateTime.parse(s.trim(), DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
        } catch (Exception ex) {
            return null;
        }
    }

    /** 北京时间（pair_update_time，UTC+8）→ 转 UTC 落库。 */
    private LocalDateTime parseChinaTime(String s) {
        if (s == null || s.isBlank()) return null;
        try {
            LocalDateTime ldt = LocalDateTime.parse(s.trim(), DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
            return ldt.atZone(ZoneId.of("Asia/Shanghai"))
                    .withZoneSameInstant(ZoneId.of("UTC")).toLocalDateTime();
        } catch (Exception ex) {
            return null;
        }
    }

    /** Y-m-d 纯日期（first_order_time / on_sale_time）。 */
    private LocalDate parseDate(String s) {
        if (s == null || s.isBlank()) return null;
        try {
            return LocalDate.parse(s.trim(), DateTimeFormatter.ofPattern("yyyy-MM-dd"));
        } catch (Exception ex) {
            return null;
        }
    }

    private String guessZoneId(String v) {
        if (v.endsWith("PST") || v.endsWith("PDT")) return "America/Los_Angeles";
        if (v.endsWith("EST") || v.endsWith("EDT")) return "America/New_York";
        if (v.endsWith("CST") || v.endsWith("CDT")) return "America/Chicago";
        if (v.endsWith("MST") || v.endsWith("MDT")) return "America/Denver";
        if (v.endsWith("GMT") || v.endsWith("UTC")) return "UTC";
        return null;
    }

    // ---------- 取值工具 ----------

    private String asText(JsonNode row, String key) {
        JsonNode n = row.path(key);
        if (n.isMissingNode() || n.isNull()) return null;
        String v = n.asText("");
        return v.isEmpty() ? null : v;
    }

    private Integer asInt(JsonNode row, String key) {
        JsonNode n = row.path(key);
        if (n.isMissingNode() || n.isNull()) return null;
        if (n.isNumber()) return n.asInt();
        String v = n.asText("").trim();
        if (v.isEmpty()) return null;
        try {
            return (int) Double.parseDouble(v);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private Long asLong(JsonNode row, String key) {
        JsonNode n = row.path(key);
        if (n.isMissingNode() || n.isNull()) return null;
        if (n.isNumber()) return n.asLong();
        String v = n.asText("").trim();
        if (v.isEmpty()) return null;
        try {
            return Long.parseLong(v.replace(".0", ""));
        } catch (NumberFormatException ex) {
            return null;
        }
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

    /** JSON 数组/对象字段原样留底为字符串。 */
    private String asJsonString(JsonNode row, String key) {
        JsonNode n = row.path(key);
        if (n.isMissingNode() || n.isNull()) return null;
        if (n.isTextual()) return n.asText();
        String s = n.toString();
        return "[]".equals(s) || "{}".equals(s) ? null : s;
    }

    private void sleep(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}