package com.sjzm.product.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sjzm.product.config.SellerspriteConfig;
import com.sjzm.product.entity.DengZongShop;
import com.sjzm.product.entity.DengZongShopSeller;
import com.sjzm.product.mapper.DengZongShopMapper;
import com.sjzm.product.mapper.DengZongShopSellerMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class DengZongShopService {

    private final SellerspriteConfig config;
    private final SellerspriteConfigService sellerspriteConfigService;
    private final DengZongShopMapper mapper;
    private final DengZongShopSellerMapper sellerMapper;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    /**
     * 按店铺名查询卖家精灵 API 并存入 deng_zong_shop 表
     */
    public Map<String, Object> syncBySellerName(String sellerName, String marketplace) {
        int total = 0;
        int inserted = 0;
        int page = 1;

        while (true) {
            log.info("同步店铺数据: sellerName={}, marketplace={}, page={}", sellerName, marketplace, page);
            JsonNode data = callApi(sellerName, marketplace, page, 100);
            if (data == null) break;

            int apiTotal = data.path("total").asInt(0);
            JsonNode items = data.path("items");
            if (items == null || !items.isArray() || items.isEmpty()) break;

            total = apiTotal;
            for (JsonNode item : items) {
                try {
                    DengZongShop entity = mapToEntity(item, marketplace);
                    mapper.insert(entity);
                    inserted++;
                } catch (Exception e) {
                    log.warn("插入失败: asin={}, error={}", item.path("asin").asText(), e.getMessage());
                }
            }

            if (inserted >= total) break;
            page++;
            try { Thread.sleep(300); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
        }

        log.info("同步完成: sellerName={}, total={}, inserted={}", sellerName, total, inserted);
        Map<String, Object> result = new HashMap<>();
        result.put("total", total);
        result.put("inserted", inserted);
        return result;
    }

    private JsonNode callApi(String sellerName, String marketplace, int page, int size) {
        try {
            String body = objectMapper.writeValueAsString(Map.of(
                    "marketplace", marketplace,
                    "sellerName", sellerName,
                    "asins", new String[]{},
                    "variation", "N",
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
                log.error("卖家精灵 API 错误: {}", result.path("message").asText());
                return null;
            }
            return result.path("data");
        } catch (Exception e) {
            log.error("调用卖家精灵 API 失败: {}", e.getMessage(), e);
            return null;
        }
    }

    private DengZongShop mapToEntity(JsonNode item, String marketplace) {
        DengZongShop e = new DengZongShop();
        e.setMarketplace(marketplace);
        e.setAsin(item.path("asin").asText(null));
        e.setMonth(java.time.YearMonth.now().toString().replace("-", ""));
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
        e.setUnits(item.path("units").isNumber() ? item.path("units").intValue() : null);
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
        e.setSellerName(item.path("sellerName").asText(null));
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
        e.setSource(item.path("source").asText(null));
        if (item.path("availableDate").isNumber()) {
            e.setAvailableDate(item.path("availableDate").longValue());
        }
        
        e.setUpdatedAt(LocalDateTime.now());
        return e;
    }

    private BigDecimal getBigDecimal(JsonNode node, String field) {
        JsonNode v = node.path(field);
        if (v.isNumber()) return v.decimalValue();
        if (v.isTextual()) {
            try { return new BigDecimal(v.asText().replace("%", "")); } catch (Exception ignored) {}
        }
        return null;
    }

    // ===== MED-6: 委托方法 — Controller 不再直接注入 Mapper =====
    public long countGroupedByParent(String marketplace, String month, String brand,
            String sellerName, String title, String category, String bsrId, Long nodeId,
            java.math.BigDecimal priceMin, java.math.BigDecimal priceMax, Integer bsrMax,
            java.math.BigDecimal ratingMin, String weightMax) {
        return mapper.countGroupedByParent(marketplace, month, brand, sellerName, title, category, bsrId, nodeId,
                priceMin, priceMax, bsrMax, ratingMin, weightMax);
    }

    public List<DengZongShop> selectGroupedByParent(String marketplace, String month, String brand,
            String sellerName, String title, String category, String bsrId, Long nodeId,
            java.math.BigDecimal priceMin, java.math.BigDecimal priceMax, Integer bsrMax,
            java.math.BigDecimal ratingMin, String weightMax,
            String sortBy, String sortOrder, int offset, int size) {
        return mapper.selectGroupedByParent(marketplace, month, brand, sellerName, title, category, bsrId, nodeId,
                priceMin, priceMax, bsrMax, ratingMin, weightMax, sortBy, sortOrder, offset, size);
    }

    public List<DengZongShop> shopSelectList(LambdaQueryWrapper<DengZongShop> qw) {
        return mapper.selectList(qw);
    }

    public long shopSelectCount(LambdaQueryWrapper<DengZongShop> qw) {
        return mapper.selectCount(qw);
    }

    public List<Map<String, Object>> selectSellerSummary(String marketplace) {
        return mapper.selectSellerSummary(marketplace);
    }

    public List<DengZongShopSeller> sellerSelectList(LambdaQueryWrapper<DengZongShopSeller> qw) {
        return sellerMapper.selectList(qw);
    }

    public int sellerInsert(DengZongShopSeller seller) {
        return sellerMapper.insert(seller);
    }

    public int sellerUpdateById(DengZongShopSeller seller) {
        return sellerMapper.updateById(seller);
    }

    public int sellerDeleteById(Long id) {
        return sellerMapper.deleteById(id);
    }

    private String getNestedText(JsonNode node, String parent, String field) {
        JsonNode p = node.path(parent);
        if (p.isMissingNode()) return null;
        JsonNode v = p.path(field);
        return v.isMissingNode() ? null : v.asText(null);
    }

    public String getMaxMonth(String marketplace) {
        return mapper.selectMaxMonth(marketplace);
    }
}
