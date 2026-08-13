package com.sjzm.product.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.databind.JsonNode;
import com.sjzm.common.PageResult;
import com.sjzm.product.dto.CompetitorLookupRequest;
import com.sjzm.product.dto.CompetitorProductResponse;
import com.sjzm.product.dto.CompetitorQueryRequest;
import com.sjzm.product.util.DayBatchSupport;
import com.sjzm.product.entity.CompetitorProduct;
import com.sjzm.product.entity.CompetitorSubcategory;
import com.sjzm.product.mapper.CompetitorProductMapper;
import com.sjzm.product.mapper.CompetitorSubcategoryMapper;
import com.sjzm.product.mapper.SkipAsinMapper;
import com.sjzm.product.mapper.ShopMapper;
import com.sjzm.product.methodrule.M01Rule;
import com.sjzm.product.methodrule.M03Rule;
import com.sjzm.product.modules.bazhuayu.entity.PremiumProduct;
import com.sjzm.product.modules.bazhuayu.mapper.PremiumProductMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

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
    private final PremiumProductMapper premiumProductMapper;

    private static final int BATCH_SIZE = 40;

    /**
     * 批量查询竞品：将 ASIN 按 40 个一批分块调用 API
     * 每批正好 40 个，最后不足 40 个的丢弃不浪费请求次数
     */
    @Deprecated(forRemoval = true)
    public List<CompetitorProductResponse> lookupAndSave(CompetitorLookupRequest request) {
        rejectLegacyDirectExecution();
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
        return doLookupAndSave(request, month, batchTime, ssApi::competitorLookup);
    }

    /**
     * 单批查询 + 入库的可注入执行入口。
     * 请求中心传入统一执行网关，以便每页调用关联到 run/item 审计；旧入口保留默认卖家精灵代理。
     */
    public Map<String, Object> doLookupAndSave(CompetitorLookupRequest request, String month,
                                               java.time.LocalDateTime batchTime,
                                               Function<CompetitorLookupRequest, JsonNode> lookupExecutor) {
        log.info("API请求参数: marketplace={}, variation={}, size={}, page={}, asins={}个, month={}",
                request.getMarketplace(), request.getVariation(), request.getSize(), request.getPage(),
                request.getAsins() != null ? request.getAsins().size() : 0, month);

        String marketplace = request.getMarketplace();
        Set<String> requestedAsins = request.getAsins() == null
                ? Set.of()
                : request.getAsins().stream()
                        .filter(StringUtils::hasText)
                        .map(value -> value.trim().toUpperCase(Locale.ROOT))
                        .collect(Collectors.toCollection(LinkedHashSet::new));
        Set<String> returnedAsins = new LinkedHashSet<>();
        Set<String> writtenAsins = new LinkedHashSet<>();
        List<CompetitorProductResponse> results = new ArrayList<>();
        List<CompetitorProduct> savedProducts = new ArrayList<>();
        List<CompetitorSubcategory> allSubcategories = new ArrayList<>();
        List<Long> productIdsForSubs = new ArrayList<>();

        // 翻页拉取：remainder > 70 才多翻一页
        int page = 1;
        int total = 0;
        while (true) {
            request.setPage(page);
            JsonNode data = lookupExecutor.apply(request);
            if (page == 1) {
                total = data.path("total").asInt(0);
            }
            JsonNode items = data.path("items");
            int itemCount = items.isArray() ? items.size() : 0;
            log.info("API返回 page={}: total={}, items={}条", page, total, itemCount);

            for (JsonNode item : items) {
                try {
                    String asin = item.path("asin").asText();
                    String normalizedAsin = asin == null ? "" : asin.trim().toUpperCase(Locale.ROOT);
                    if (StringUtils.hasText(normalizedAsin)) {
                        returnedAsins.add(normalizedAsin);
                    }
                    CompetitorProduct product = mapToEntity(item, marketplace, asin, month);
                    product.setCreatedAt(batchTime);
                    product.setUpdatedAt(batchTime);
                    upsertProduct(product);
                    // 收集子类别（不立即插入）
                    List<CompetitorProductResponse.SubcategoryDto> subDtos = collectSubcategories(item, product.getId(), allSubcategories);
                    productIdsForSubs.add(product.getId());
                    results.add(toResponse(product, subDtos));
                    savedProducts.add(product);
                    if (StringUtils.hasText(normalizedAsin)) {
                        writtenAsins.add(normalizedAsin);
                    }
                } catch (Exception e) {
                    log.warn("单条商品入库失败 (asin={}): {}", item.path("asin").asText(), e.getMessage());
                }
            }

            // 每批最多2页（200条），避免超级变体父ASIN吃光卖家精灵使用次数
            int fetched = results.size();
            if (fetched >= total || itemCount < request.getSize()) break;
            if (page >= 2) {
                log.info("已达翻页上限2页，停止 (已获取{}条/total={})", fetched, total);
                break;
            }
            page++;
            // 翻页间隔，避免突发请求触发卖家精灵频率限制（与批量导入一致）
            try { Thread.sleep(2000); } catch (InterruptedException ignored) {}
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
        List<String> missingAsins = requestedAsins.stream()
                .filter(asin -> !writtenAsins.contains(asin))
                .toList();
        long returnedRequestedCount = requestedAsins.stream().filter(returnedAsins::contains).count();
        long writtenRequestedCount = requestedAsins.size() - missingAsins.size();
        summary.put("products", results);
        summary.put("total", requestedAsins.size());
        summary.put("fetchedCount", Math.toIntExact(returnedRequestedCount));
        summary.put("writtenCount", Math.toIntExact(writtenRequestedCount));
        summary.put("failedCount", missingAsins.size());
        summary.put("missingAsins", missingAsins);
        summary.put("responseProductCount", results.size());
        summary.put("warning", missingAsins.isEmpty()
                ? null
                : "卖家精灵未返回或未写入 " + missingAsins.size() + " 个请求 ASIN");
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
     * 精品榜专用卖家精灵入库。复用同一份响应字段映射，但只写 premium_products，
     * 不执行新品榜初筛、不写 skip_asins，也不刷新 competitor_products_clean。
     */
    public Map<String, Object> doPremiumLookupAndSave(
            CompetitorLookupRequest request,
            String month,
            LocalDateTime batchTime,
            Long mappingId,
            String bazhuayuTaskId,
            String taskName,
            String weekTag,
            String sourceRunId,
            Function<CompetitorLookupRequest, JsonNode> lookupExecutor) {
        log.info("精品榜 API 请求: marketplace={}, asins={}个, mappingId={}, weekTag={}",
                request.getMarketplace(), request.getAsins() != null ? request.getAsins().size() : 0,
                mappingId, weekTag);

        Set<String> requestedAsins = request.getAsins() == null
                ? Set.of()
                : request.getAsins().stream()
                        .filter(StringUtils::hasText)
                        .map(value -> value.trim().toUpperCase(Locale.ROOT))
                        .collect(Collectors.toCollection(LinkedHashSet::new));
        Set<String> returnedAsins = new LinkedHashSet<>();
        Set<String> writtenAsins = new LinkedHashSet<>();
        int page = 1;
        int apiCalls = 0;
        int responseTotal = 0;
        while (true) {
            request.setPage(page);
            JsonNode data = lookupExecutor.apply(request);
            apiCalls++;
            if (page == 1) responseTotal = data.path("total").asInt(0);
            JsonNode items = data.path("items");
            int itemCount = items.isArray() ? items.size() : 0;

            for (JsonNode item : items) {
                try {
                    String asin = item.path("asin").asText("").trim().toUpperCase(Locale.ROOT);
                    if (!StringUtils.hasText(asin) || !requestedAsins.contains(asin)) {
                        log.warn("精品榜忽略非本批请求 ASIN: marketplace={}, asin={}",
                                request.getMarketplace(), asin);
                        continue;
                    }
                    returnedAsins.add(asin);
                    CompetitorProduct mapped = mapToEntity(item, request.getMarketplace(), asin, month);
                    PremiumProduct premium = new PremiumProduct();
                    BeanUtils.copyProperties(mapped, premium);
                    premium.setSource("精品榜");
                    premium.setWeekTag(weekTag);
                    premium.setIsCurrent(1);
                    premium.setBazhuayuMappingId(mappingId);
                    premium.setBazhuayuTaskId(bazhuayuTaskId);
                    premium.setBazhuayuTaskName(taskName);
                    premium.setSourceRunId(sourceRunId);
                    premium.setSellerspriteRawJson(item.toString());
                    premium.setDeleted(0);
                    premium.setCreatedAt(batchTime);
                    premium.setUpdatedAt(batchTime);
                    premiumProductMapper.insertOnDuplicateKeyUpdate(premium);
                    writtenAsins.add(asin);
                } catch (Exception e) {
                    log.warn("精品榜单条商品入库失败 (asin={}): {}", item.path("asin").asText(), e.getMessage());
                }
            }

            if (returnedAsins.size() >= responseTotal || itemCount < request.getSize()) break;
            if (page >= 2) {
                log.info("精品榜已达翻页上限2页，停止 (已返回{}条/total={})",
                        returnedAsins.size(), responseTotal);
                break;
            }
            page++;
            try {
                Thread.sleep(2000);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
        }

        Map<String, Object> summary = new LinkedHashMap<>();
        List<String> missingAsins = requestedAsins.stream()
                .filter(asin -> !writtenAsins.contains(asin))
                .toList();
        summary.put("total", requestedAsins.size());
        summary.put("fetchedCount", returnedAsins.size());
        summary.put("writtenCount", writtenAsins.size());
        summary.put("failedCount", missingAsins.size());
        summary.put("missingAsins", missingAsins);
        summary.put("warning", missingAsins.isEmpty()
                ? null
                : "卖家精灵未返回 " + missingAsins.size() + " 个 ASIN，保留为待补全");
        summary.put("apiCalls", apiCalls);
        return summary;
    }

    /**
     * 查询同站点已经成功收到卖家精灵响应的精品 ASIN。
     * 分块查询避免大批次 IN 参数过长；不同站点不互相去重。
     */
    public Set<String> findEnrichedPremiumAsins(String marketplace, Collection<String> asins) {
        if (!StringUtils.hasText(marketplace) || asins == null || asins.isEmpty()) {
            return Set.of();
        }
        List<String> normalized = asins.stream()
                .filter(StringUtils::hasText)
                .map(value -> value.trim().toUpperCase(Locale.ROOT))
                .distinct()
                .toList();
        Set<String> found = new LinkedHashSet<>();
        final int chunkSize = 500;
        for (int from = 0; from < normalized.size(); from += chunkSize) {
            int to = Math.min(from + chunkSize, normalized.size());
            found.addAll(premiumProductMapper.selectEnrichedAsins(
                    marketplace.trim().toUpperCase(Locale.ROOT), normalized.subList(from, to)));
        }
        return found;
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

    /** 旧同步竞品查询已下线，调用方必须创建请求中心运行任务。 */
    private void rejectLegacyDirectExecution() {
        throw new UnsupportedOperationException("同步竞品查询已迁移到卖家精灵请求中心，请创建 runId 后查看执行进度");
    }

    private static String truncate(String s, int maxLen) {
        return s != null && s.length() > maxLen ? s.substring(0, maxLen) : s;
    }

    public CompetitorProduct mapToEntity(JsonNode item, String marketplace, String asin, String month) {
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

    /** 批量 upsert 并执行筛选（供卖家名导入等外部调用），单店铺产品写入原子化 */
    @Transactional(rollbackFor = Exception.class)
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


    public PageResult<CompetitorProductResponse> queryFromDb(CompetitorQueryRequest request) {
        return queryFromDb(request, false);
    }

    /** 精品页统一选品查询：沿用同一套筛选字段，但固定读取 premium_products 原始表。 */
    public PageResult<CompetitorProductResponse> queryPremiumFromDb(CompetitorQueryRequest request) {
        return queryFromDb(request, true);
    }

    private PageResult<CompetitorProductResponse> queryFromDb(
            CompetitorQueryRequest request,
            boolean premiumSource) {

        LambdaQueryWrapper<CompetitorProduct> wrapper = new LambdaQueryWrapper<>();
        // 排除空壳追踪记录
        wrapper.isNotNull(CompetitorProduct::getTitle);
        if (premiumSource) {
            // 八爪鱼原始 ASIN 只是请求中心的待处理暂存，不属于精品页面可展示商品。
            // 只有卖家精灵真实返回并落过原始响应的记录才进入列表、筛选和导出。
            wrapper.apply("deleted = 0")
                    .apply("sellersprite_raw_json IS NOT NULL AND TRIM(sellersprite_raw_json) != ''");
        }
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
        if (StringUtils.hasText(request.getBsrId())) {
            wrapper.eq(CompetitorProduct::getBsrId, request.getBsrId());
        }
        if (request.getNodeId() != null) {
            wrapper.eq(CompetitorProduct::getNodeId, request.getNodeId());
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
        if (StringUtils.hasText(request.getCategory())) {
            List<String> categories = splitCsv(request.getCategory());
            if (!categories.isEmpty()) {
                String placeholders = IntStream.range(0, categories.size())
                        .mapToObj(i -> "{" + i + "}")
                        .collect(Collectors.joining(","));
                wrapper.apply(
                        "TRIM(SUBSTRING_INDEX(node_label_path, ':', 1)) IN (" + placeholders + ")",
                        categories.toArray());
            }
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
            wrapper.apply("FIND_IN_SET(week_tag, {0})", request.getWeekTag());
        }
        if (StringUtils.hasText(request.getCreatedAtStart())) {
            wrapper.apply("created_at >= {0}", request.getCreatedAtStart());
        }
        if (StringUtils.hasText(request.getCreatedAtEnd())) {
            wrapper.apply("created_at <= {0}", request.getCreatedAtEnd() + " 23:59:59");
        }
        if (request.getIsCurrent() != null) {
            wrapper.eq(CompetitorProduct::getIsCurrent, request.getIsCurrent());
        }

        // ── 品线模型筛选（P5 新增）──
        if (request.getPriceMin() != null) {
            wrapper.ge(CompetitorProduct::getPrice, request.getPriceMin());
        }
        if (request.getPriceMax() != null) {
            wrapper.le(CompetitorProduct::getPrice, request.getPriceMax());
        }
        if (request.getBsrMax() != null) {
            wrapper.gt(CompetitorProduct::getBsr, 0);
            wrapper.le(CompetitorProduct::getBsr, request.getBsrMax());
        }
        if (request.getRatingMin() != null) {
            wrapper.ge(CompetitorProduct::getRating, request.getRatingMin());
        }
        if (request.getWeightMax() != null) {
            wrapper.le(CompetitorProduct::getWeightG, request.getWeightMax());
        }
        if (StringUtils.hasText(request.getKeywords())) {
            // 逗号分隔多词，所有词需同时匹配标题（AND 语义）
            String[] words = request.getKeywords().split(",");
            for (String word : words) {
                String trimmed = word.strip();
                if (!trimmed.isEmpty()) {
                    wrapper.like(CompetitorProduct::getTitle, trimmed);
                }
            }
        }

        // ── 筛选重构新增：面板区间直连 wrapper ──
        if (request.getUnitsMin() != null) {
            wrapper.ge(CompetitorProduct::getUnits, request.getUnitsMin());
        }
        if (request.getUnitsMax() != null) {
            wrapper.le(CompetitorProduct::getUnits, request.getUnitsMax());
        }
        if (request.getListingDaysMin() != null) {
            wrapper.ge(CompetitorProduct::getListingDays, request.getListingDaysMin());
        }
        if (request.getListingDaysMax() != null) {
            wrapper.le(CompetitorProduct::getListingDays, request.getListingDaysMax());
        }
        if (request.getFulfillment() != null && !request.getFulfillment().isEmpty()) {
            wrapper.in(CompetitorProduct::getFulfillment, request.getFulfillment());
        }
        // 批次过滤统一按「单天导入日期」。前端回传值可能是新的 yyyy-MM-dd，
        // 也可能是旧的 ISO 周（2026-W30）——一律经 DayBatchSupport 归一到日期后按 DATE(created_at) 过滤。
        if (request.getCreatedWeeks() != null && !request.getCreatedWeeks().isEmpty()) {
            List<String> days = request.getCreatedWeeks().stream()
                    .map(DayBatchSupport::normalizeToDate)
                    .filter(StringUtils::hasText)
                    .distinct()
                    .collect(Collectors.toList());
            if (!days.isEmpty()) {
                String placeholders = IntStream.range(0, days.size())
                        .mapToObj(i -> "{" + i + "}")
                        .collect(Collectors.joining(","));
                wrapper.apply("DATE(created_at) IN (" + placeholders + ")", days.toArray());
            }
        } else if (StringUtils.hasText(request.getCreatedWeek())) {
            // backward compatibility with single value（周或日期均归一到日期）
            String day = DayBatchSupport.normalizeToDate(request.getCreatedWeek());
            if (StringUtils.hasText(day)) {
                wrapper.apply("DATE(created_at) = {0}", day);
            }
        }

        // ── 灵活合格规则（规则间 OR：满足任一即合格，取代写死的 MODE1 过滤）──
        applyQualifyRules(wrapper, request.getQualifyRules());

        if (premiumSource) {
            applyPremiumMethodRule(wrapper, request.getMethodId(), request.getMarketplace());
        }

        // 动态排序（白名单列名）。listingDate 需要“空值置后”的复合 ORDER BY，
        // 在分页 tail 中统一拼接，避免 MySQL 升序时把 NULL 放到页面最前面。
        applySort(wrapper, request.getSortBy(), request.getSortOrder());

        // 数据源切换：默认查清洗表（按父 ASIN 去重的代表行）；false 走原始表。
        boolean useClean = !premiumSource && !Boolean.FALSE.equals(request.getUseCleanTable());

        // maxVariantCount 变体数上限筛选：两种场景分别处理
        if (request.getMaxVariantCount() != null) {
            if (useClean) {
                // 清洗表场景：清洗表的 variations 列已存父 ASIN 的变体数,直接 WHERE 过滤
                // 注意 variations 可能为 NULL（独立品），独立品视为 1 个变体，按需放行
                wrapper.apply("(variations <= {0} OR variations IS NULL)", request.getMaxVariantCount());
            } else if (StringUtils.hasText(request.getMarketplace())) {
                // 原始表场景：用 dedup_key 子查询限定父群组的变体行数 ≤ 阈值
                String sourceTable = premiumSource ? "premium_products" : "competitor_products";
                String sourceGuard = premiumSource ? " AND deleted = 0" : "";
                wrapper.apply(
                    "COALESCE(NULLIF(parent_asin,''), asin) IN ("
                    + "SELECT t.k FROM ("
                    + "  SELECT COALESCE(NULLIF(parent_asin,''), asin) AS k, COUNT(*) AS c"
                    + "  FROM " + sourceTable + " WHERE marketplace = {0} AND title IS NOT NULL" + sourceGuard
                    + "  GROUP BY COALESCE(NULLIF(parent_asin,''), asin)"
                    + "  HAVING c <= {1}"
                    + ") t)",
                    request.getMarketplace(), request.getMaxVariantCount());
            }
        }

        // 手动分页（避免 MyBatis-Plus count 查询问题）
        long total;
        int offset = (request.getPage() - 1) * request.getSize();
        int size = Math.max(1, Math.min(request.getSize(), 100)); // 限制最大100
        List<? extends CompetitorProduct> records;
        if (premiumSource) {
            total = premiumProductMapper.selectCountForSelection(wrapper);
            applyPagination(wrapper, request.getSortBy(), request.getSortOrder(), offset, size);
            records = premiumProductMapper.selectListForSelection(wrapper);
        } else if (useClean) {
            total = productMapper.selectCountFromClean(wrapper);
            applyPagination(wrapper, request.getSortBy(), request.getSortOrder(), offset, size);
            records = productMapper.selectListFromClean(wrapper);
        } else {
            total = productMapper.selectCount(wrapper);
            applyPagination(wrapper, request.getSortBy(), request.getSortOrder(), offset, size);
            records = productMapper.selectList(wrapper);
        }

        // 回填变体数：用 (marketplace, dedup_key) 批量统计原表中每个父群组下的变体行数。
        // 清洗表场景下这是用户最关心的信息（一行代表 vs 实际 N 个变体）。
        if (!records.isEmpty() && StringUtils.hasText(request.getMarketplace())) {
            List<String> dedupKeys = records.stream()
                    .map(p -> {
                        String parent = p.getParentAsin();
                        return (parent == null || parent.isEmpty()) ? p.getAsin() : parent;
                    })
                    .distinct()
                    .collect(Collectors.toList());
            List<Map<String, Object>> variantRows = premiumSource
                    ? premiumProductMapper.selectVariantCountsByDedupKeys(request.getMarketplace(), dedupKeys)
                    : productMapper.selectVariantCountsByDedupKeys(request.getMarketplace(), dedupKeys);
            Map<String, Long> variantCountMap = variantRows.stream()
                    .collect(Collectors.toMap(
                            row -> String.valueOf(row.get("dedupKey")),
                            row -> ((Number) row.get("variantCount")).longValue()));
            for (CompetitorProduct p : records) {
                String parent = p.getParentAsin();
                String key = (parent == null || parent.isEmpty()) ? p.getAsin() : parent;
                Long cnt = variantCountMap.get(key);
                p.setVariantCount(cnt != null ? cnt.intValue() : 1);
            }
        }

        // 批量查子类目，避免 N+1
        List<Long> productIds = records.stream().map(CompetitorProduct::getId).collect(Collectors.toList());
        Map<Long, List<CompetitorSubcategory>> subMap = premiumSource || productIds.isEmpty()
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

    public List<CompetitorProductResponse> getPremiumVariants(String marketplace, String parentAsin) {
        LambdaQueryWrapper<CompetitorProduct> wrapper = new LambdaQueryWrapper<CompetitorProduct>()
                .eq(CompetitorProduct::getMarketplace, marketplace)
                .and(w -> w.eq(CompetitorProduct::getParentAsin, parentAsin)
                        .or().eq(CompetitorProduct::getAsin, parentAsin))
                .isNotNull(CompetitorProduct::getTitle)
                .apply("deleted = 0")
                .apply("sellersprite_raw_json IS NOT NULL AND TRIM(sellersprite_raw_json) != ''")
                .orderByAsc(CompetitorProduct::getBsr);
        return premiumProductMapper.selectListForSelection(wrapper).stream()
                .map(p -> toResponse(p, Collections.emptyList()))
                .collect(Collectors.toList());
    }

    public List<CompetitorProductResponse> getHistory(String marketplace, String asin) {
        List<CompetitorProduct> list = productMapper.selectList(
                new LambdaQueryWrapper<CompetitorProduct>()
                        .eq(CompetitorProduct::getMarketplace, marketplace)
                        .eq(CompetitorProduct::getAsin, asin)
                        .orderByDesc(CompetitorProduct::getMonth));
        return list.stream().map(p -> toResponse(p, Collections.emptyList())).collect(Collectors.toList());
    }

    public CompetitorProductResponse toResponse(CompetitorProduct p, List<CompetitorProductResponse.SubcategoryDto> subs) {
        CompetitorProductResponse.CompetitorProductResponseBuilder builder = CompetitorProductResponse.builder()
                .id(p.getId())
                .enriched(p.getEnriched())
                .marketplace(p.getMarketplace()).asin(p.getAsin()).month(p.getMonth())
                .title(p.getTitle()).brand(p.getBrand()).brandUrl(p.getBrandUrl())
                .imageUrl(p.getImageUrl()).parentAsin(p.getParentAsin()).sku(p.getSku())
                .nodeId(p.getNodeId()).nodeIdPath(p.getNodeIdPath()).nodeLabelPath(p.getNodeLabelPath())
                .symbol(p.getSymbol())
                .units(p.getUnits()).salesTier(p.getSalesTier()).unitsGr(p.getUnitsGr()).amzUnit(p.getAmzUnit())
                .amzSales(p.getAmzSales()).revenue(p.getRevenue())
                .bsrId(p.getBsrId()).bsr(p.getBsr()).bsrCr(p.getBsrCr()).bsrCv(p.getBsrCv())
                .ratings(p.getRatings()).rating(p.getRating()).ratingsRate(p.getRatingsRate())
                .ratingsCv(p.getRatingsCv()).ratingDelta(p.getRatingDelta())
                .price(p.getPrice()).primePrice(p.getPrimePrice()).deliveryPrice(p.getDeliveryPrice()).profit(p.getProfit()).fba(p.getFba())
                .sellerName(p.getSellerName()).sellerNation(p.getSellerNation()).sellers(p.getSellers())
                .fulfillment(p.getFulfillment()).variations(p.getVariations())
                .weight(p.getWeight()).dimension(p.getDimension())
                .dimensionsType(p.getDimensionsType())
                .pkgDimensions(p.getPkgDimensions())
                .pkgDimensionType(p.getPkgDimensionType())
                .pkgWeight(p.getPkgWeight())
                .lqs(p.getLqs())
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
                .createdAt(p.getCreatedAt() != null ? p.getCreatedAt().format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")) : null)
                .updatedAt(p.getUpdatedAt() != null ? p.getUpdatedAt().format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")) : null)
                .shopLink(buildShopLink(p.getSellerId(), p.getMarketplace()))
                .variantCount(p.getVariantCount())
                .subcategories(subs);
        if (p instanceof PremiumProduct premium) {
            builder.bazhuayuMappingId(premium.getBazhuayuMappingId())
                    .bazhuayuTaskId(premium.getBazhuayuTaskId())
                    .bazhuayuTaskName(premium.getBazhuayuTaskName())
                    .sourceRunId(premium.getSourceRunId());
        }
        return builder.build();
    }

    // 合格规则字段/运算符白名单（防注入：列名与运算符只能取这些值）
    private static final Map<String, String> RULE_COLUMN = Map.of(
            "listingDays", "listing_days",
            "weightG", "weight_g",
            "units", "units",
            "bsr", "bsr");
    private static final Map<String, String> RULE_OP = Map.of(
            "lt", "<", "le", "<=", "ge", ">=", "gt", ">", "eq", "=");

    private boolean isValidCondition(CompetitorQueryRequest.RuleCondition c) {
        return c != null && c.getValue() != null
                && c.getField() != null && RULE_COLUMN.containsKey(c.getField())
                && c.getOp() != null && RULE_OP.containsKey(c.getOp());
    }

    /** 清洗规则：丢弃无效条件与空规则，返回仅含有效条件的规则列表 */
    private List<CompetitorQueryRequest.QualifyRule> effectiveRules(List<CompetitorQueryRequest.QualifyRule> rules) {
        if (rules == null) return List.of();
        List<CompetitorQueryRequest.QualifyRule> out = new ArrayList<>();
        for (CompetitorQueryRequest.QualifyRule r : rules) {
            if (r == null || r.getConditions() == null) continue;
            List<CompetitorQueryRequest.RuleCondition> valid = r.getConditions().stream()
                    .filter(this::isValidCondition).collect(Collectors.toList());
            if (!valid.isEmpty()) {
                CompetitorQueryRequest.QualifyRule nr = new CompetitorQueryRequest.QualifyRule();
                nr.setConditions(valid);
                out.add(nr);
            }
        }
        return out;
    }

    private void applyCondition(LambdaQueryWrapper<CompetitorProduct> x, CompetitorQueryRequest.RuleCondition c) {
        String col = RULE_COLUMN.get(c.getField());
        String op = RULE_OP.get(c.getOp());
        if (col == null || op == null || c.getValue() == null) return;
        // 排名守卫：排除无排名(null/0)的记录，避免 "bsr < 5000" 误纳入未上榜商品
        if ("bsr".equals(c.getField())) x.apply("bsr > 0");
        // col / op 取自白名单，安全拼接；阈值用 {0} 绑定
        x.apply(col + " " + op + " {0}", c.getValue());
    }

    /**
     * 拼接灵活合格规则：在 base 条件之上 AND 一组「规则间 OR」的约束。
     * - 规则内部：条件 AND（如 listing_days≤30 AND units>30）
     * - 规则之间：OR（满足任一即合格）
     * - 字段/运算符白名单校验，无效条件与空规则已被 effectiveRules 清洗
     */
    private void applyQualifyRules(LambdaQueryWrapper<CompetitorProduct> wrapper,
                                   List<CompetitorQueryRequest.QualifyRule> rules) {
        List<CompetitorQueryRequest.QualifyRule> effective = effectiveRules(rules);
        if (effective.isEmpty()) return;

        // wrapper.and(...) 把整组包进一对括号，与外层 base 条件 AND；
        // 组内用 .nested(规则) 生成 (条件 AND 条件)，相邻规则间用 .or() 切成 OR 连接。
        wrapper.and(outer -> {
            boolean first = true;
            for (CompetitorQueryRequest.QualifyRule r : effective) {
                if (!first) outer.or();
                outer.nested(x -> {
                    for (CompetitorQueryRequest.RuleCondition c : r.getConditions()) applyCondition(x, c);
                });
                first = false;
            }
        });
    }

    /** 方法卡只收窄精品表，不允许切换到新品榜或店铺商品表。 */
    private void applyPremiumMethodRule(
            LambdaQueryWrapper<CompetitorProduct> wrapper,
            String methodId,
            String marketplace) {
        if (!StringUtils.hasText(methodId)) {
            return;
        }
        String normalized = methodId.trim().toUpperCase(Locale.ROOT);
        if ("M01".equals(normalized)) {
            M01Rule rule = M01Rule.forMarketplace(marketplace);
            wrapper.ge(CompetitorProduct::getPrice, rule.priceMin())
                    .le(CompetitorProduct::getPrice, rule.priceMax())
                    .lt(CompetitorProduct::getWeightG, rule.weightMax())
                    .lt(CompetitorProduct::getListingDays, rule.listingDaysMax())
                    .and(units -> units.isNull(CompetitorProduct::getUnits)
                            .or()
                            .le(CompetitorProduct::getUnits, rule.salesMax()))
                    .and(group -> {
                        group.and(days30 -> days30
                                        .le(CompetitorProduct::getListingDays, 30)
                                        .ge(CompetitorProduct::getUnits, rule.sales30()))
                                .or(days60 -> days60
                                        .gt(CompetitorProduct::getListingDays, 30)
                                        .le(CompetitorProduct::getListingDays, 60)
                                        .ge(CompetitorProduct::getUnits, rule.sales60()))
                                .or(days90 -> days90
                                        .gt(CompetitorProduct::getListingDays, 60)
                                        .lt(CompetitorProduct::getListingDays, rule.listingDaysMax())
                                        .ge(CompetitorProduct::getUnits, rule.sales90()));
                        if (rule.bsrMax() != null) {
                            group.or(bsr -> bsr
                                    .gt(CompetitorProduct::getBsr, 0)
                                    .lt(CompetitorProduct::getBsr, rule.bsrMax()));
                        }
                    });
            return;
        }
        if ("M03".equals(normalized)) {
            M03Rule rule = M03Rule.forMarketplace(marketplace);
            wrapper.apply("UPPER(fulfillment) = {0}", "FBM")
                    .lt(CompetitorProduct::getListingDays, rule.listingDaysMax())
                    .ge(CompetitorProduct::getUnits, rule.sales90());
            return;
        }
        throw new IllegalArgumentException("精品选品仅支持 M01 或 M03 方法卡");
    }

    private void applySort(LambdaQueryWrapper<CompetitorProduct> wrapper, String sortBy, String sortOrder) {
        boolean asc = "asc".equalsIgnoreCase(sortOrder);
        switch (sortBy != null ? sortBy : "units") {
            case "price" -> wrapper.orderBy(true, asc, CompetitorProduct::getPrice);
            case "bsr" -> wrapper.orderBy(true, asc, CompetitorProduct::getBsr);
            case "listingDays" -> wrapper.orderBy(true, asc, CompetitorProduct::getListingDays);
            // listingDate / availableDate 由 applyPagination 生成复合 ORDER BY：空值置后 + ASIN 稳定次序。
            case "listingDate", "availableDate" -> { }
            case "createdAt" -> wrapper.orderBy(true, asc, CompetitorProduct::getCreatedAt);
            case "ratings" -> wrapper.orderBy(true, asc, CompetitorProduct::getRatings);
            case "rating" -> wrapper.orderBy(true, asc, CompetitorProduct::getRating);
            case "weightG" -> wrapper.orderBy(true, asc, CompetitorProduct::getWeightG);
            case "score" -> wrapper.orderBy(true, asc, CompetitorProduct::getScore);
            default -> wrapper.orderBy(true, asc, CompetitorProduct::getUnits);
        }
    }

    public long getProductCount() { return productMapper.selectCount(null); }
    public long getSkipAsinCount() { return skipAsinMapper.selectCount(null); }
    public long getShopCount() { return shopMapper.selectCount(null); }

    /**
     * 实时按 created_at 计算入库批次（ISO 周）+ 每周条数，按周倒序，第一条即最新批次。
     * @param source 来源（新品/竞品/郑总），按 LIKE 匹配；null 则不限来源
     * @param filterMode 筛选模式，null 则不限
     */
    public List<Map<String, Object>> getCreatedWeeks(String marketplace, String source, String filterMode) {
        return getCreatedWeeks(marketplace, source, filterMode, false);
    }

    /** 周批次数量必须与页面当前选择的 clean/raw 数据源一致。 */
    public List<Map<String, Object>> getCreatedWeeks(
            String marketplace, String source, String filterMode, boolean useCleanTable) {
        if (useCleanTable) {
            return productMapper.selectCleanCreatedWeeksWithCount(marketplace, source);
        }
        return productMapper.selectCreatedWeeksWithCount(marketplace, source, filterMode);
    }

    public List<Map<String, Object>> getPremiumCreatedWeeks(String marketplace) {
        return premiumProductMapper.selectCreatedWeeksWithCount(marketplace);
    }

    public List<Map<String, Object>> getPremiumCategories(String marketplace) {
        return premiumProductMapper.selectCategoriesWithCount(marketplace);
    }

    public List<Map<String, Object>> getPremiumSellers(String marketplace) {
        return premiumProductMapper.selectSellers(marketplace);
    }

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

    private void applyPagination(
            LambdaQueryWrapper<CompetitorProduct> wrapper,
            String sortBy,
            String sortOrder,
            int offset,
            int size) {
        if ("listingDate".equals(sortBy) || "availableDate".equals(sortBy)) {
            String direction = "asc".equalsIgnoreCase(sortOrder) ? "ASC" : "DESC";
            wrapper.last("ORDER BY available_date IS NULL ASC, available_date " + direction
                    + ", asin ASC LIMIT " + offset + "," + size);
            return;
        }
        wrapper.last("LIMIT " + offset + "," + size);
    }

    private List<String> splitCsv(String raw) {
        if (!StringUtils.hasText(raw)) {
            return List.of();
        }
        return Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(StringUtils::hasText)
                .distinct()
                .collect(Collectors.toList());
    }
}
