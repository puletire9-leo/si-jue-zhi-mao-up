package com.sjzm.product.modules.shopcollection.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sjzm.product.config.SellerspriteConfig;
import com.sjzm.product.modules.shopcollection.entity.ShopProduct;
import com.sjzm.product.modules.shopcollection.mapper.ShopProductMapper;
import com.sjzm.product.service.ApiRateLimitService;
import com.sjzm.product.service.SellerspriteApiService;
import com.sjzm.product.service.SellerspriteConfigService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;

/**
 * 店铺商品全集抓取：卖家精灵"店铺名查询"，固定 variation=Y（不含变体父体口径），写 shop_products。
 *
 * <p>与 {@link com.sjzm.product.service.DengZongShopService#syncBySellerName} 抓取范式一致，
 * 但落到独立的 shop_products 表——deng_zong_shop 保持郑总盘子专用，两条数据源分开。
 * 落库前做基础标准化：sales_tier（A≥100/B≥50/C≥15/D，与店铺画像 SQL 对齐）、
 * listing_days（按 available_date 实时算）、raw_json 整包留底。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ShopProductSyncService {

    private final SellerspriteConfig config;
    private final SellerspriteConfigService sellerspriteConfigService;
    private final SellerspriteApiService sellerspriteApiService;
    private final ApiRateLimitService rateLimitService;
    private final ShopProductMapper mapper;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    /**
     * 按店铺名抓取店铺商品全集并写入 shop_products。
     *
     * @param sellerName  店铺名
     * @param marketplace 站点（UK/DE/US）
     * @param fetchReason 抓取原因（M01高命中/人工加入/郑总相似），可空
     * @param watchlistId 来源观察池记录 id，可空
     */
    public Map<String, Object> syncBySellerName(String sellerName, String marketplace,
                                                String fetchReason, Long watchlistId) {
        String runId = "SHOP_" + marketplace + "_" + LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"))
                + "_" + Integer.toHexString((sellerName + System.identityHashCode(this)).hashCode());
        String batchDate = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        int total = 0;
        int inserted = 0;
        int fetched = 0;
        int apiCalls = 0;
        int page = 1;
        int pageSize = 100;

        while (true) {
            log.info("抓取店铺全集: sellerName={}, marketplace={}, page={}", sellerName, marketplace, page);
            JsonNode data = callApi(sellerName, marketplace, page, pageSize);
            apiCalls++;
            if (data == null) break;

            int apiTotal = data.path("total").asInt(0);
            JsonNode items = data.path("items");
            if (items == null || !items.isArray() || items.isEmpty()) break;

            total = apiTotal;
            int pageItems = items.size();
            fetched += pageItems;
            for (JsonNode item : items) {
                try {
                    ShopProduct entity = mapToEntity(item, sellerName, marketplace, batchDate, runId, fetchReason, watchlistId);
                    int affected = mapper.upsert(entity);
                    if (affected > 0) inserted++;
                } catch (Exception e) {
                    log.warn("店铺商品写入失败: asin={}, error={}", item.path("asin").asText(), e.getMessage());
                }
            }

            if ((total > 0 && fetched >= total) || pageItems < pageSize) break;
            page++;
            try { Thread.sleep(300); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
        }

        log.info("店铺全集抓取完成: sellerName={}, total={}, fetched={}, inserted={}, runId={}",
                sellerName, total, fetched, inserted, runId);
        Map<String, Object> result = new HashMap<>();
        result.put("sellerName", sellerName);
        result.put("marketplace", marketplace);
        result.put("total", total);
        result.put("fetched", fetched);
        result.put("inserted", inserted);
        result.put("apiCalls", apiCalls);
        result.put("runId", runId);
        result.put("batchDate", batchDate);
        return result;
    }

    private JsonNode callApi(String sellerName, String marketplace, int page, int size) {
        rateLimitService.checkRequestQuota();
        long startTime = System.currentTimeMillis();
        String apiStatus = "OK";
        String errorMsg = null;
        try {
            String body = objectMapper.writeValueAsString(Map.of(
                    "marketplace", marketplace,
                    "sellerName", sellerName,
                    "asins", new String[]{},
                    "variation", "Y",
                    "page", page,
                    "size", size,
                    "orderDesc", true
            ));

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(config.getApiUrl() + "/product/competitor-lookup"))
                    .header("secret-key", sellerspriteConfigService.getSecretKey())
                    .header("Content-Type", "application/json")
                    .timeout(config.getReadTimeout())
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            JsonNode result = objectMapper.readTree(response.body());

            if (!"OK".equals(result.path("code").asText())) {
                apiStatus = "ERROR";
                errorMsg = result.path("message").asText();
                log.error("卖家精灵店铺查询错误: {}", errorMsg);
                return null;
            }
            return result.path("data");
        } catch (Exception e) {
            apiStatus = "ERROR";
            errorMsg = e.getMessage();
            log.error("调用卖家精灵店铺查询失败: {}", e.getMessage(), e);
            return null;
        } finally {
            long took = System.currentTimeMillis() - startTime;
            sellerspriteApiService.logApiCall(marketplace, currentMonth(), 0, took, apiStatus, errorMsg);
        }
    }

    private ShopProduct mapToEntity(JsonNode item, String requestSellerName, String marketplace, String batchDate,
                                    String runId, String fetchReason, Long watchlistId) {
        ShopProduct e = new ShopProduct();
        e.setMarketplace(marketplace);
        e.setAsin(item.path("asin").asText(null));
        e.setMonth(YearMonth.now().toString().replace("-", ""));
        e.setTitle(item.path("title").asText(null));
        e.setBrand(item.path("brand").asText(null));
        e.setBrandUrl(item.path("brandUrl").asText(null));
        e.setImageUrl(item.path("imageUrl").asText(null));
        e.setParentAsin(item.path("parent").asText(item.path("parentAsin").asText(null)));
        e.setSku(item.path("sku").asText(null));
        e.setNodeId(item.path("nodeId").isNumber() ? item.path("nodeId").longValue() : null);
        e.setNodeIdPath(item.path("nodeIdPath").asText(null));
        e.setNodeLabelPath(item.path("nodeLabelPath").asText(null));
        e.setSymbol(item.path("symbol").asText(null));
        Integer units = item.path("units").isNumber() ? item.path("units").intValue() : null;
        e.setUnits(units);
        e.setSalesTier(classifySalesTier(units));
        e.setUnitsGr(getBigDecimal(item, "unitsGr"));
        e.setAmzUnit(item.path("amzUnit").isNumber() ? item.path("amzUnit").intValue() : null);
        e.setAmzSales(getBigDecimal(item, "amzSales"));
        e.setRevenue(getBigDecimal(item, "revenue"));
        e.setBsrId(item.path("bsrId").asText(null));
        e.setBsr(item.path("bsr").isNumber() ? item.path("bsr").intValue() : null);
        e.setBsrCr(getBigDecimal(item, "bsrCr"));
        e.setBsrCv(item.path("bsrCv").isNumber() ? item.path("bsrCv").intValue() : null);
        e.setRatings(item.path("ratings").isNumber() ? item.path("ratings").intValue() : null);
        e.setRating(getBigDecimal(item, "rating"));
        e.setRatingsRate(getBigDecimal(item, "ratingsRate"));
        e.setRatingsCv(item.path("ratingsCv").isNumber() ? item.path("ratingsCv").intValue() : null);
        e.setRatingDelta(item.path("ratingDelta").isNumber() ? item.path("ratingDelta").intValue() : null);
        e.setPrice(getBigDecimal(item, "price"));
        e.setPrimePrice(getBigDecimal(item, "primePrice"));
        e.setProfit(getBigDecimal(item, "profit"));
        e.setFba(getBigDecimal(item, "fba"));
        e.setDeliveryPrice(getBigDecimal(item, "deliveryPrice"));
        String returnedSellerName = item.path("sellerName").asText(null);
        e.setSellerName(returnedSellerName == null || returnedSellerName.isBlank() ? requestSellerName : returnedSellerName);
        e.setSellerId(item.path("sellerId").asText(null));
        e.setSellerNation(item.path("sellerNation").asText(null));
        e.setSellers(item.path("sellers").isNumber() ? item.path("sellers").intValue() : null);
        e.setFulfillment(item.path("fulfillment").asText(null));
        e.setVariations(item.path("variations").isNumber() ? item.path("variations").intValue() : null);
        e.setWeight(item.path("weight").asText(null));
        e.setDimension(item.path("dimension").asText(null));
        e.setBestSeller(getNestedText(item, "badge", "bestSeller"));
        e.setAmazonChoice(getNestedText(item, "badge", "amazonChoice"));
        e.setNewRelease(getNestedText(item, "badge", "newRelease"));
        e.setEbc(getNestedText(item, "badge", "ebc"));
        e.setVideo(getNestedText(item, "badge", "video"));
        e.setProductUrl(item.path("productUrl").asText(null));
        e.setSimilarUrl(item.path("similarUrl").asText(null));
        e.setSource(item.path("source").asText("店铺全集"));
        Long availableDate = item.path("availableDate").isNumber() ? item.path("availableDate").longValue() : null;
        e.setAvailableDate(availableDate);
        e.setListingDays(calcListingDays(availableDate));

        e.setBatchDate(batchDate);
        e.setSourceRunId(runId);
        e.setFetchSource("SELLERSPRITE_SHOP");
        e.setFetchReason(fetchReason);
        e.setWatchlistId(watchlistId);
        e.setVariationMode("Y");
        e.setRawJson(item.toString());
        return e;
    }

    /** 销量分级，阈值与 ShopProfileMapper.rankedFromDengZong 一致：A≥100 / B≥50 / C≥15 / D / UNKNOWN。 */
    private String classifySalesTier(Integer units) {
        if (units == null) return "UNKNOWN";
        if (units >= 100) return "A";
        if (units >= 50) return "B";
        if (units >= 15) return "C";
        return "D";
    }

    /** 上架天数：available_date 为毫秒时间戳，缺失返回 null（店铺全集不做 89 天新品兜底，忠实反映数据）。 */
    private Integer calcListingDays(Long availableDate) {
        if (availableDate == null || availableDate <= 0) return null;
        long days = (System.currentTimeMillis() - availableDate) / 86_400_000L;
        return days < 0 ? 0 : (int) days;
    }

    private BigDecimal getBigDecimal(JsonNode node, String field) {
        JsonNode v = node.path(field);
        if (v.isNumber()) return v.decimalValue();
        if (v.isTextual()) {
            try { return new BigDecimal(v.asText().replace("%", "")); } catch (Exception ignored) {}
        }
        return null;
    }

    private String getNestedText(JsonNode node, String parent, String field) {
        JsonNode p = node.path(parent);
        if (p.isMissingNode()) return null;
        JsonNode v = p.path(field);
        return v.isMissingNode() ? null : v.asText(null);
    }

    private String currentMonth() {
        return YearMonth.now().format(DateTimeFormatter.ofPattern("yyyyMM"));
    }
}
