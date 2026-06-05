package com.sjzm.product.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.databind.JsonNode;
import com.sjzm.common.PageResult;
import com.sjzm.product.dto.CompetitorLookupRequest;
import com.sjzm.product.dto.CompetitorProductResponse;
import com.sjzm.product.dto.CompetitorQueryRequest;
import com.sjzm.product.entity.CompetitorProduct;
import com.sjzm.product.entity.CompetitorSubcategory;
import com.sjzm.product.mapper.CompetitorProductMapper;
import com.sjzm.product.mapper.CompetitorSubcategoryMapper;
import com.sjzm.product.mapper.SkipAsinMapper;
import com.sjzm.product.mapper.ShopMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class CompetitorService {

    private final SellerspriteApiService ssApi;
    private final CompetitorProductMapper productMapper;
    private final CompetitorSubcategoryMapper subcategoryMapper;
    private final CompetitorFilterService filterService;
    private final SkipAsinMapper skipAsinMapper;
    private final ShopMapper shopMapper;

    private static final int BATCH_SIZE = 40;

    /**
     * 批量查询竞品：将 ASIN 按 40 个一批分块调用 API
     * 每批正好 40 个，最后不足 40 个的丢弃不浪费请求次数
     */
    public List<CompetitorProductResponse> lookupAndSave(CompetitorLookupRequest request) {
        List<String> allAsins = request.getAsins();
        List<List<String>> batches = partition(allAsins, BATCH_SIZE);

        log.info("竞品查询分块: 总ASIN={}, 完整批次={}, 丢弃={}",
                allAsins.size(), batches.size(),
                allAsins.size() - batches.size() * BATCH_SIZE);

        List<CompetitorProductResponse> allResults = new ArrayList<>();

        for (int i = 0; i < batches.size(); i++) {
            List<String> batch = batches.get(i);
            log.info("处理第 {}/{} 批, ASIN 数量: {}", i + 1, batches.size(), batch.size());

            // 构建单批请求
            CompetitorLookupRequest batchRequest = new CompetitorLookupRequest();
            batchRequest.setMarketplace(request.getMarketplace());
            batchRequest.setAsins(batch);
            batchRequest.setBrand(request.getBrand());
            batchRequest.setSellerName(request.getSellerName());
            batchRequest.setNodeIdPath(request.getNodeIdPath());
            batchRequest.setNodeIdPathEqual(request.getNodeIdPathEqual());
            batchRequest.setKeyword(request.getKeyword());
            batchRequest.setMatchType(request.getMatchType());
            batchRequest.setVariation(request.getVariation());
            batchRequest.setPage(request.getPage());
            batchRequest.setSize(request.getSize());
            batchRequest.setOrderField(request.getOrderField());
            batchRequest.setOrderDesc(request.getOrderDesc());

            String month = request.getMonth() != null ? request.getMonth()
                    : java.time.YearMonth.now().format(java.time.format.DateTimeFormatter.ofPattern("yyyyMM"));
            @SuppressWarnings("unchecked")
            List<CompetitorProductResponse> batchResults = (List<CompetitorProductResponse>)
                    doLookupAndSave(batchRequest, month, java.time.LocalDateTime.now()).get("products");
            allResults.addAll(batchResults);
        }

        return allResults;
    }

    /**
     * 单批查询 + 入库，返回统计摘要供前端进度显示
     */
    public Map<String, Object> doLookupAndSave(CompetitorLookupRequest request, String month, java.time.LocalDateTime batchTime) {
        log.info("API请求参数: marketplace={}, variation={}, size={}, page={}, asins={}个, month={}",
                request.getMarketplace(), request.getVariation(), request.getSize(), request.getPage(),
                request.getAsins() != null ? request.getAsins().size() : 0, month);

        String marketplace = request.getMarketplace();
        List<CompetitorProductResponse> results = new ArrayList<>();
        List<CompetitorProduct> savedProducts = new ArrayList<>();
        List<CompetitorSubcategory> allSubcategories = new ArrayList<>();
        List<Long> productIdsForSubs = new ArrayList<>();

        // 翻页拉取：remainder > 70 才多翻一页
        int page = 1;
        int total = 0;
        while (true) {
            request.setPage(page);
            JsonNode data = ssApi.competitorLookup(request);
            if (page == 1) {
                total = data.path("total").asInt(0);
            }
            JsonNode items = data.path("items");
            int itemCount = items.isArray() ? items.size() : 0;
            log.info("API返回 page={}: total={}, items={}条", page, total, itemCount);

            for (JsonNode item : items) {
                try {
                    String asin = item.path("asin").asText();
                    CompetitorProduct product = mapToEntity(item, marketplace, asin, month);
                    product.setCreatedAt(batchTime);
                    product.setUpdatedAt(batchTime);
                    upsertProduct(product);
                    // 收集子类别（不立即插入）
                    List<CompetitorProductResponse.SubcategoryDto> subDtos = collectSubcategories(item, product.getId(), allSubcategories);
                    productIdsForSubs.add(product.getId());
                    results.add(toResponse(product, subDtos));
                    savedProducts.add(product);
                } catch (Exception e) {
                    log.warn("单条商品入库失败 (asin={}): {}", item.path("asin").asText(), e.getMessage());
                }
            }

            // 每批最多2页（200条），避免超级变体父ASIN吃光配额
            int fetched = results.size();
            if (fetched >= total || itemCount < request.getSize()) break;
            if (page >= 2) {
                log.info("已达翻页上限2页，停止 (已获取{}条/total={})", fetched, total);
                break;
            }
            page++;
        }

        // 批量写入子类别：先批量删除，再批量插入
        if (!productIdsForSubs.isEmpty()) {
            subcategoryMapper.delete(new LambdaQueryWrapper<CompetitorSubcategory>()
                    .in(CompetitorSubcategory::getProductId, productIdsForSubs));
            if (!allSubcategories.isEmpty()) {
                subcategoryMapper.insertBatch(allSubcategories);
            }
        }

        // 批量追踪所有请求过的父 ASIN（INSERT IGNORE，唯一键冲突静默跳过）
        List<CompetitorProduct> trackingRecords = new ArrayList<>(request.getAsins().size());
        for (String requestedAsin : request.getAsins()) {
            CompetitorProduct track = new CompetitorProduct();
            track.setMarketplace(marketplace);
            track.setAsin(requestedAsin);
            track.setMonth(month);
            track.setCreatedAt(batchTime);
            track.setUpdatedAt(batchTime);
            trackingRecords.add(track);
        }
        if (!trackingRecords.isEmpty()) {
            productMapper.insertBatchIgnoreDup(trackingRecords);
        }

        // 统计
        int mode1 = 0, mode2 = 0, fail = 0, newProductPassed = 0;
        if (!savedProducts.isEmpty()) {
            CompetitorFilterService.FilterResult fr = filterService.filter(
                    savedProducts, marketplace, "新品榜", month);
            mode1 = fr.getMode1Count();
            mode2 = fr.getMode2Count();
            fail = fr.getFailCount();
            newProductPassed = fr.getNewProductPassed();
            log.info("筛选结果: 总计={}, 模式一={}, 模式二={}, 未通过={}, 30天新品通过={}",
                    fr.getTotalCount(), mode1, mode2, fail, newProductPassed);
        }

        // 统计父/变体
        int parentCount = 0, variantCount = 0;
        for (CompetitorProductResponse r : results) {
            String parent = r.getParentAsin();
            if (parent == null || parent.isEmpty() || parent.equals(r.getAsin())) {
                parentCount++;
            } else {
                variantCount++;
            }
        }

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("products", results);
        summary.put("total", results.size());
        summary.put("mode1", mode1);
        summary.put("mode2", mode2);
        summary.put("fail", fail);
        summary.put("newProductPassed", newProductPassed);
        summary.put("apiCalls", page);
        summary.put("parentAsinCount", parentCount);
        summary.put("variantAsinCount", variantCount);
        return summary;
    }

    /**
     * 将 ASIN 列表按每批 40 个分块，丢弃不足 40 的尾块
     */
    private List<List<String>> partition(List<String> asins, int batchSize) {
        List<List<String>> batches = new ArrayList<>();
        int total = asins.size();
        int fullBatches = total / batchSize;

        for (int i = 0; i < fullBatches; i++) {
            int from = i * batchSize;
            int to = from + batchSize;
            batches.add(new ArrayList<>(asins.subList(from, to)));
        }
        // 尾部不足 batchSize 的补一批（避免总量 < batchSize 时全部丢弃）
        int remainder = total - fullBatches * batchSize;
        if (remainder > 0) {
            batches.add(new ArrayList<>(asins.subList(fullBatches * batchSize, total)));
        }
        return batches;
    }

    private static String truncate(String s, int maxLen) {
        return s != null && s.length() > maxLen ? s.substring(0, maxLen) : s;
    }

    private CompetitorProduct mapToEntity(JsonNode item, String marketplace, String asin, String month) {
        CompetitorProduct product = new CompetitorProduct();
        product.setMarketplace(marketplace);
        product.setAsin(asin);
        product.setMonth(month);

        product.setTitle(truncate(item.path("title").asText(), 1000));
        product.setBrand(item.path("brand").asText());
        product.setBrandUrl(item.path("brandUrl").asText());
        product.setImageUrl(item.path("imageUrl").asText());
        product.setParentAsin(item.path("parent").asText());
        product.setSku(item.path("sku").asText());
        product.setNodeId(parseLong(item, "nodeId"));
        product.setNodeIdPath(item.path("nodeIdPath").asText());
        product.setNodeLabelPath(item.path("nodeLabelPath").asText());
        product.setSymbol(item.path("symbol").asText());

        product.setUnits(parseInt(item, "units"));
        product.setUnitsGr(parseBigDecimal(item, "unitsGr"));
        product.setAmzUnit(parseInt(item, "amzUnit"));
        product.setAmzSales(parseBigDecimal(item, "amzSales"));
        product.setAmzUnitDate(parseLong(item, "amzUnitDate"));
        product.setRevenue(parseBigDecimal(item, "revenue"));

        product.setBsrId(item.path("bsrId").asText());
        product.setBsr(parseInt(item, "bsr"));
        product.setBsrCr(parseBigDecimal(item, "bsrCr"));
        product.setBsrCv(parseInt(item, "bsrCv"));

        product.setRatings(parseInt(item, "ratings"));
        product.setRating(parseBigDecimal(item, "rating"));
        product.setRatingsRate(parseBigDecimal(item, "ratingsRate"));
        product.setRatingsCv(parseInt(item, "ratingsCv"));
        product.setRatingDelta(parseInt(item, "ratingDelta"));

        product.setPrice(parseBigDecimal(item, "price"));
        product.setPrimePrice(parseBigDecimal(item, "primePrice"));
        product.setProfit(parseBigDecimal(item, "profit"));
        product.setFba(parseBigDecimal(item, "fba"));
        product.setDeliveryPrice(parseBigDecimal(item, "deliveryPrice"));

        product.setSellerName(item.path("sellerName").asText());
        product.setSellerId(item.path("sellerId").asText());
        product.setSellerNation(item.path("sellerNation").asText());
        product.setSellers(parseInt(item, "sellers"));

        product.setFulfillment(item.path("fulfillment").asText());
        product.setVariations(parseInt(item, "variations"));
        product.setWeight(item.path("weight").asText());
        product.setDimension(item.path("dimension").asText());
        product.setDimensionsType(item.path("dimensionsType").asText());
        product.setPkgDimensions(item.path("pkgDimensions").asText());
        product.setPkgDimensionType(item.path("pkgDimensionType").asText());
        product.setPkgWeight(item.path("pkgWeight").asText());

        product.setLqs(parseBigDecimal(item, "lqs"));
        product.setAvailableDate(parseLong(item, "availableDate"));

        JsonNode badge = item.path("badge");
        product.setBestSeller(badge.path("bestSeller").asText());
        product.setAmazonChoice(badge.path("amazonChoice").asText());
        product.setNewRelease(badge.path("newRelease").asText());
        product.setEbc(badge.path("ebc").asText());
        product.setVideo(badge.path("video").asText());

        return product;
    }

    private void upsertProduct(CompetitorProduct product) {
        productMapper.insertOnDuplicateKeyUpdate(product);
    }

    /** 批量 upsert 并执行筛选（供卖家名导入等外部调用） */
    public int upsertAndFilter(List<CompetitorProduct> products, String marketplace, String source, String month) {
        for (CompetitorProduct p : products) {
            upsertProduct(p);
        }
        if (!products.isEmpty()) {
            filterService.filter(products, marketplace, source, month);
        }
        return products.size();
    }

    private List<CompetitorProductResponse.SubcategoryDto> collectSubcategories(
            JsonNode item, Long productId, List<CompetitorSubcategory> collector) {
        JsonNode subcategories = item.path("subcategories");
        List<CompetitorProductResponse.SubcategoryDto> subDtos = new ArrayList<>();
        if (subcategories.isArray()) {
            for (JsonNode sc : subcategories) {
                CompetitorSubcategory sub = new CompetitorSubcategory();
                sub.setProductId(productId);
                sub.setCode(sc.path("code").asText());
                sub.setRankValue(sc.path("rank").asInt());
                sub.setLabel(sc.path("label").asText());
                collector.add(sub);

                subDtos.add(CompetitorProductResponse.SubcategoryDto.builder()
                        .code(sub.getCode())
                        .rankValue(sub.getRankValue())
                        .label(sub.getLabel())
                        .build());
            }
        }
        return subDtos;
    }


    private PageResult<CompetitorProductResponse> queryGroupedByParent(CompetitorQueryRequest request) {
        int offset = (request.getPage() - 1) * request.getSize();
        // 校验排序方向，防止 SQL 注入
        String sortOrder = "asc".equalsIgnoreCase(request.getSortOrder()) ? "ASC" : "DESC";
        List<CompetitorProduct> records = productMapper.selectGroupedByParent(
                request.getMarketplace(), request.getMonth(), request.getSource(),
                request.getFilterMode(), request.getBrand(), request.getSellerName(),
                request.getTitle(), request.getGrade(), request.getWeekTag(),
                request.getIsCurrent(), request.getMaxVariantCount(), request.getCategory(),
                request.getSortBy(), sortOrder, offset, request.getSize());

        long total = productMapper.countGroupedByParent(
                request.getMarketplace(), request.getMonth(), request.getSource(), request.getFilterMode(),
                request.getBrand(), request.getSellerName(), request.getTitle(),
                request.getGrade(), request.getWeekTag(), request.getIsCurrent(),
                request.getMaxVariantCount(), request.getCategory());

        // 批量查子类目，避免 N+1
        List<Long> productIds = records.stream().map(CompetitorProduct::getId).collect(Collectors.toList());
        Map<Long, List<CompetitorSubcategory>> subMap = productIds.isEmpty()
                ? Map.of()
                : subcategoryMapper.selectByProductIds(productIds).stream()
                        .collect(Collectors.groupingBy(CompetitorSubcategory::getProductId));

        List<CompetitorProductResponse> list = records.stream()
                .map(p -> {
                    List<CompetitorSubcategory> subs = subMap.getOrDefault(p.getId(), List.of());
                    List<CompetitorProductResponse.SubcategoryDto> subDtos = subs.stream()
                            .map(s -> CompetitorProductResponse.SubcategoryDto.builder()
                                    .code(s.getCode()).rankValue(s.getRankValue()).label(s.getLabel()).build())
                            .collect(Collectors.toList());
                    CompetitorProductResponse resp = toResponse(p, subDtos);
                    resp.setVariantCount(p.getVariantCount());
                    return resp;
                }).collect(Collectors.toList());

        return PageResult.of(list, total, (long) request.getPage(), (long) request.getSize());
    }

    public PageResult<CompetitorProductResponse> queryFromDb(CompetitorQueryRequest request) {

        // 按 parent_asin 去重
        if (Boolean.TRUE.equals(request.getGroupByParent())) {
            return queryGroupedByParent(request);
        }

        LambdaQueryWrapper<CompetitorProduct> wrapper = new LambdaQueryWrapper<>();
        // 排除空壳追踪记录
        wrapper.isNotNull(CompetitorProduct::getTitle);
        if (StringUtils.hasText(request.getMarketplace())) {
            wrapper.eq(CompetitorProduct::getMarketplace, request.getMarketplace());
        }
        if (StringUtils.hasText(request.getMonth())) {
            wrapper.eq(CompetitorProduct::getMonth, request.getMonth());
        }
        if (request.getAsin() != null && !request.getAsin().isEmpty()) {
            wrapper.in(CompetitorProduct::getAsin, request.getAsin());
        }
        if (StringUtils.hasText(request.getSource())) {
            wrapper.like(CompetitorProduct::getSource, request.getSource());
        }
        if (StringUtils.hasText(request.getFilterMode())) {
            wrapper.eq(CompetitorProduct::getFilterMode, request.getFilterMode());
        }
        if (StringUtils.hasText(request.getBrand())) {
            wrapper.like(CompetitorProduct::getBrand, request.getBrand());
        }
        if (StringUtils.hasText(request.getSellerName())) {
            wrapper.like(CompetitorProduct::getSellerName, request.getSellerName());
        }
        if (StringUtils.hasText(request.getTitle())) {
            wrapper.like(CompetitorProduct::getTitle, request.getTitle());
        }
        if (StringUtils.hasText(request.getGrade())) {
            List<String> grades = java.util.Arrays.asList(request.getGrade().split(","));
            if (grades.size() == 1) {
                wrapper.eq(CompetitorProduct::getGrade, grades.get(0));
            } else {
                wrapper.in(CompetitorProduct::getGrade, grades);
            }
        }
        if (StringUtils.hasText(request.getWeekTag())) {
            wrapper.eq(CompetitorProduct::getWeekTag, request.getWeekTag());
        }
        if (request.getIsCurrent() != null) {
            wrapper.eq(CompetitorProduct::getIsCurrent, request.getIsCurrent());
        }

        // 动态排序（白名单列名）
        applySort(wrapper, request.getSortBy(), request.getSortOrder());

        // 手动分页（避免 MyBatis-Plus count 查询问题）
        long total = productMapper.selectCount(wrapper);
        int offset = (request.getPage() - 1) * request.getSize();
        int size = Math.max(1, Math.min(request.getSize(), 100)); // 限制最大100
        wrapper.last("LIMIT " + offset + "," + size);

        List<CompetitorProduct> records = productMapper.selectList(wrapper);

        // 批量查子类目，避免 N+1
        List<Long> productIds = records.stream().map(CompetitorProduct::getId).collect(Collectors.toList());
        Map<Long, List<CompetitorSubcategory>> subMap = productIds.isEmpty()
                ? Map.of()
                : subcategoryMapper.selectByProductIds(productIds).stream()
                        .collect(Collectors.groupingBy(CompetitorSubcategory::getProductId));

        List<CompetitorProductResponse> list = records.stream()
                .map(p -> {
                    List<CompetitorSubcategory> subs = subMap.getOrDefault(p.getId(), List.of());
                    List<CompetitorProductResponse.SubcategoryDto> subDtos = subs.stream()
                            .map(s -> CompetitorProductResponse.SubcategoryDto.builder()
                                    .code(s.getCode()).rankValue(s.getRankValue()).label(s.getLabel()).build())
                            .collect(Collectors.toList());
                    return toResponse(p, subDtos);
                }).collect(Collectors.toList());

        return PageResult.of(list, total, (long) request.getPage(), (long) request.getSize());
    }

    public List<CompetitorProductResponse> getVariants(String marketplace, String parentAsin) {
        // 找到 parent_asin 对应的所有变体（包含父 ASIN 自身）
        List<CompetitorProduct> list = productMapper.selectList(
                new LambdaQueryWrapper<CompetitorProduct>()
                        .eq(CompetitorProduct::getMarketplace, marketplace)
                        .and(w -> w.eq(CompetitorProduct::getParentAsin, parentAsin)
                                .or().eq(CompetitorProduct::getAsin, parentAsin))
                        .isNotNull(CompetitorProduct::getTitle)
                        .orderByAsc(CompetitorProduct::getBsr));
        return list.stream().map(p -> toResponse(p, Collections.emptyList())).collect(Collectors.toList());
    }

    public List<CompetitorProductResponse> getHistory(String marketplace, String asin) {
        List<CompetitorProduct> list = productMapper.selectList(
                new LambdaQueryWrapper<CompetitorProduct>()
                        .eq(CompetitorProduct::getMarketplace, marketplace)
                        .eq(CompetitorProduct::getAsin, asin)
                        .orderByDesc(CompetitorProduct::getMonth));
        return list.stream().map(p -> toResponse(p, Collections.emptyList())).collect(Collectors.toList());
    }

    private CompetitorProductResponse toResponse(CompetitorProduct p, List<CompetitorProductResponse.SubcategoryDto> subs) {
        return CompetitorProductResponse.builder()
                .id(p.getId())
                .marketplace(p.getMarketplace()).asin(p.getAsin()).month(p.getMonth())
                .title(p.getTitle()).brand(p.getBrand()).brandUrl(p.getBrandUrl())
                .imageUrl(p.getImageUrl()).parentAsin(p.getParentAsin()).sku(p.getSku())
                .nodeId(p.getNodeId()).nodeIdPath(p.getNodeIdPath()).nodeLabelPath(p.getNodeLabelPath())
                .symbol(p.getSymbol())
                .units(p.getUnits()).unitsGr(p.getUnitsGr()).amzUnit(p.getAmzUnit())
                .amzSales(p.getAmzSales()).revenue(p.getRevenue())
                .bsrId(p.getBsrId()).bsr(p.getBsr()).bsrCr(p.getBsrCr()).bsrCv(p.getBsrCv())
                .ratings(p.getRatings()).rating(p.getRating()).ratingsRate(p.getRatingsRate())
                .ratingsCv(p.getRatingsCv()).ratingDelta(p.getRatingDelta())
                .price(p.getPrice()).primePrice(p.getPrimePrice()).deliveryPrice(p.getDeliveryPrice()).profit(p.getProfit()).fba(p.getFba())
                .sellerName(p.getSellerName()).sellerNation(p.getSellerNation()).sellers(p.getSellers())
                .fulfillment(p.getFulfillment()).variations(p.getVariations())
                .weight(p.getWeight()).dimension(p.getDimension())
                .availableDate(p.getAvailableDate() != null ? new java.text.SimpleDateFormat("yyyy-MM-dd").format(new java.util.Date(p.getAvailableDate())) : null)
                .bestSeller(p.getBestSeller()).amazonChoice(p.getAmazonChoice())
                .newRelease(p.getNewRelease()).ebc(p.getEbc()).video(p.getVideo())
                // 衍生字段
                .filterMode(p.getFilterMode())
                .filterReasons(p.getFilterReasons())
                .listingDays(p.getListingDays())
                .weightG(p.getWeightG())
                .productUrl(p.getProductUrl())
                .similarUrl(p.getSimilarUrl())
                .source(p.getSource())
                .score(p.getScore())
                .grade(p.getGrade())
                .weekTag(p.getWeekTag())
                .isCurrent(p.getIsCurrent())
                .sellerId(p.getSellerId())
                .shopLink(buildShopLink(p.getSellerId(), p.getMarketplace()))
                .subcategories(subs)
                .build();
    }

    private void applySort(LambdaQueryWrapper<CompetitorProduct> wrapper, String sortBy, String sortOrder) {
        boolean asc = "asc".equalsIgnoreCase(sortOrder);
        switch (sortBy != null ? sortBy : "units") {
            case "price" -> wrapper.orderBy(true, asc, CompetitorProduct::getPrice);
            case "bsr" -> wrapper.orderBy(true, asc, CompetitorProduct::getBsr);
            case "listingDays" -> wrapper.orderBy(true, asc, CompetitorProduct::getListingDays);
            case "createdAt" -> wrapper.orderBy(true, asc, CompetitorProduct::getCreatedAt);
            case "ratings" -> wrapper.orderBy(true, asc, CompetitorProduct::getRatings);
            case "rating" -> wrapper.orderBy(true, asc, CompetitorProduct::getRating);
            case "score" -> wrapper.orderBy(true, asc, CompetitorProduct::getScore);
            default -> wrapper.orderBy(true, asc, CompetitorProduct::getUnits);
        }
    }

    public long getProductCount() { return productMapper.selectCount(null); }
    public long getSkipAsinCount() { return skipAsinMapper.selectCount(null); }
    public long getShopCount() { return shopMapper.selectCount(null); }

    private String buildShopLink(String sellerId, String marketplace) {
        if (sellerId == null || sellerId.isEmpty()) return null;
        String domain = switch (marketplace) {
            case "DE" -> "https://www.amazon.de";
            case "US" -> "https://www.amazon.com";
            default -> "https://www.amazon.co.uk";
        };
        String marketplaceId = switch (marketplace) {
            case "DE" -> "A1PA6795UKMFR9";
            case "US" -> "ATVPDKIKX0DER";
            default -> "A1F83G8C2ARO7P";
        };
        return domain + "/s?i=merchant-items&me=" + sellerId + "&marketplaceID=" + marketplaceId;
    }

    private Integer parseInt(JsonNode node, String field) {
        JsonNode f = node.path(field);
        return f.isNull() || f.asText().isEmpty() ? null : f.asInt();
    }

    private Long parseLong(JsonNode node, String field) {
        JsonNode f = node.path(field);
        return f.isNull() || f.asText().isEmpty() ? null : f.asLong();
    }

    private BigDecimal parseBigDecimal(JsonNode node, String field) {
        JsonNode f = node.path(field);
        if (f.isNull() || f.asText().isEmpty()) return null;
        try {
            return new BigDecimal(f.asText());
        } catch (Exception e) {
            return null;
        }
    }
}
