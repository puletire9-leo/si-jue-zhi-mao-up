package com.sjzm.product.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.sjzm.common.PageResult;
import com.sjzm.product.dto.CompetitorLookupRequest;
import com.sjzm.product.dto.CompetitorProductResponse;
import com.sjzm.product.dto.CompetitorQueryRequest;
import com.sjzm.product.entity.BrsRankingRaw;
import com.sjzm.product.entity.CompetitorProduct;
import com.sjzm.product.mapper.BrsRankingRawMapper;
import com.sjzm.product.util.DayBatchSupport;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

/**
 * BRS 榜单服务：写入 + 查询。
 * <p>写入：复用 {@link CompetitorService#mapToEntity} 做卖家精灵 JSON→实体映射（单一事实来源，
 * 杜绝字段口径漂移），落入 brs_ranking_raw；串行/限流/熔断全部沿用 executionGateway，本类不碰。
 * <p>查询：LambdaQueryWrapper&lt;BrsRankingRaw&gt; 复用继承自 CompetitorProduct 的列口径，
 * 与竞品/新品榜筛选完全一致，再用 {@link CompetitorService#toResponse} 统一出参。
 */
@Slf4j
@Service
public class BrsRankingService {

    /** BRS 榜单来源标记，选品页按 source LIKE '%BRS%' 归类。 */
    public static final String SOURCE = "BRS榜单";

    private final BrsRankingRawMapper brsMapper;
    private final CompetitorService competitorService;
    private final ProductFeatureProcessor featureProcessor;

    public BrsRankingService(BrsRankingRawMapper brsMapper,
                             CompetitorService competitorService,
                             ProductFeatureProcessor featureProcessor) {
        this.brsMapper = brsMapper;
        this.competitorService = competitorService;
        this.featureProcessor = featureProcessor;
    }

    /**
     * 卖家精灵批量查询并落入 brs_ranking_raw。仿 CompetitorService.doLookupAndSave 的翻页/映射，
     * 但目标表/来源/批次不同。executor 由请求中心传入（executionGateway 串行网关），本类不新造调用逻辑。
     *
     * @param batchDate  周批次 YYYYMMDD（写入唯一键 (marketplace, asin, batch_date)）
     * @param batchLabel 批次名称，如 UK-kitchen-30页
     * @param sourceRunId 溯源 REQ runId
     */
    public Map<String, Object> doLookupAndSave(CompetitorLookupRequest request, String month,
                                               String batchDate, String batchLabel, String sourceRunId,
                                               LocalDateTime batchTime,
                                               Function<CompetitorLookupRequest, JsonNode> executor) {
        String marketplace = request.getMarketplace();
        Set<String> requestedAsins = request.getAsins() == null ? Set.of()
                : request.getAsins().stream().filter(StringUtils::hasText)
                        .map(v -> v.trim().toUpperCase(Locale.ROOT))
                        .collect(Collectors.toCollection(LinkedHashSet::new));
        Set<String> returnedAsins = new LinkedHashSet<>();
        Set<String> writtenAsins = new LinkedHashSet<>();

        int page = 1, total = 0, fetched = 0;
        while (true) {
            request.setPage(page);
            JsonNode data = executor.apply(request);
            if (page == 1) total = data.path("total").asInt(0);
            JsonNode items = data.path("items");
            int itemCount = items.isArray() ? items.size() : 0;
            for (JsonNode item : items) {
                try {
                    String asin = item.path("asin").asText();
                    String norm = asin == null ? "" : asin.trim().toUpperCase(Locale.ROOT);
                    if (StringUtils.hasText(norm)) returnedAsins.add(norm);
                    // 复用竞品映射（单一事实来源），再拷进 BRS 实体
                    CompetitorProduct mapped = competitorService.mapToEntity(item, marketplace, asin, month);
                    BrsRankingRaw row = new BrsRankingRaw();
                    BeanUtils.copyProperties(mapped, row);
                    row.setId(null);
                    // 派生字段（listing_days/weight_g/source/product_url…）与竞品同口径
                    featureProcessor.applyBaseFeatures(row, marketplace, SOURCE);
                    row.setBatchDate(batchDate);
                    row.setBatchLabel(batchLabel);
                    row.setSourceRunId(sourceRunId);
                    row.setCreatedAt(batchTime);
                    row.setUpdatedAt(batchTime);
                    brsMapper.insertOnDuplicateKeyUpdate(row);
                    fetched++;
                    if (StringUtils.hasText(norm)) writtenAsins.add(norm);
                } catch (Exception e) {
                    log.warn("BRS 单条入库失败 (asin={}): {}", item.path("asin").asText(), e.getMessage());
                }
            }
            if (fetched >= total || itemCount < request.getSize()) break;
            if (page >= 2) break;  // 每批最多2页，避免超级变体吃光额度（与竞品一致）
            page++;
            try { Thread.sleep(2000); } catch (InterruptedException ignored) {}
        }

        List<String> missing = requestedAsins.stream().filter(a -> !writtenAsins.contains(a)).toList();
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("total", requestedAsins.size());
        summary.put("fetchedCount", (int) requestedAsins.stream().filter(returnedAsins::contains).count());
        summary.put("writtenCount", requestedAsins.size() - missing.size());
        summary.put("failedCount", missing.size());
        summary.put("missingAsins", missing);
        summary.put("responseProductCount", fetched);
        summary.put("apiCalls", page);
        log.info("BRS 入库完成: marketplace={}, batch={}, 请求={}, 返回={}, 写入={}, 缺失={}",
                marketplace, batchDate, requestedAsins.size(), returnedAsins.size(), writtenAsins.size(), missing.size());
        return summary;
    }

    /**
     * 选品页分页查询：与竞品 queryFromDb 同口径（价格/BSR/销量/上架天数/配送/周批次/关键词/排序）。
     * 因 BrsRankingRaw 继承 CompetitorProduct，列名/筛选完全一致，杜绝「筛选对不上号」。
     */
    public PageResult<CompetitorProductResponse> queryFromDb(CompetitorQueryRequest request) {
        LambdaQueryWrapper<BrsRankingRaw> w = new LambdaQueryWrapper<>();
        w.isNotNull(BrsRankingRaw::getTitle);  // 排除空壳追踪记录
        if (StringUtils.hasText(request.getMarketplace())) w.eq(BrsRankingRaw::getMarketplace, request.getMarketplace());
        if (request.getAsin() != null && !request.getAsin().isEmpty()) w.in(BrsRankingRaw::getAsin, request.getAsin());
        if (StringUtils.hasText(request.getSource())) w.like(BrsRankingRaw::getSource, request.getSource());
        if (StringUtils.hasText(request.getFilterMode())) w.eq(BrsRankingRaw::getFilterMode, request.getFilterMode());
        if (StringUtils.hasText(request.getBsrId())) w.eq(BrsRankingRaw::getBsrId, request.getBsrId());
        if (request.getNodeId() != null) w.eq(BrsRankingRaw::getNodeId, request.getNodeId());
        if (StringUtils.hasText(request.getBrand())) w.like(BrsRankingRaw::getBrand, request.getBrand());
        if (StringUtils.hasText(request.getSellerName())) w.like(BrsRankingRaw::getSellerName, request.getSellerName());
        if (StringUtils.hasText(request.getTitle())) w.like(BrsRankingRaw::getTitle, request.getTitle());
        if (request.getPriceMin() != null) w.ge(BrsRankingRaw::getPrice, request.getPriceMin());
        if (request.getPriceMax() != null) w.le(BrsRankingRaw::getPrice, request.getPriceMax());
        if (request.getBsrMax() != null) { w.gt(BrsRankingRaw::getBsr, 0); w.le(BrsRankingRaw::getBsr, request.getBsrMax()); }
        if (request.getRatingMin() != null) w.ge(BrsRankingRaw::getRating, request.getRatingMin());
        if (request.getWeightMax() != null) w.le(BrsRankingRaw::getWeightG, request.getWeightMax());
        if (request.getUnitsMin() != null) w.ge(BrsRankingRaw::getUnits, request.getUnitsMin());
        if (request.getUnitsMax() != null) w.le(BrsRankingRaw::getUnits, request.getUnitsMax());
        if (request.getListingDaysMin() != null) w.ge(BrsRankingRaw::getListingDays, request.getListingDaysMin());
        if (request.getListingDaysMax() != null) w.le(BrsRankingRaw::getListingDays, request.getListingDaysMax());
        if (request.getFulfillment() != null && !request.getFulfillment().isEmpty())
            w.in(BrsRankingRaw::getFulfillment, request.getFulfillment());
        if (StringUtils.hasText(request.getKeywords())) {
            for (String word : request.getKeywords().split(",")) {
                String t = word.strip();
                if (!t.isEmpty()) w.like(BrsRankingRaw::getTitle, t);
            }
        }
        // 周批次：统一归一到 yyyy-MM-dd 后按 DATE(created_at) 过滤（与竞品一致）
        if (request.getCreatedWeeks() != null && !request.getCreatedWeeks().isEmpty()) {
            List<String> days = request.getCreatedWeeks().stream().map(DayBatchSupport::normalizeToDate)
                    .filter(StringUtils::hasText).distinct().collect(Collectors.toList());
            if (!days.isEmpty()) {
                String ph = IntStream.range(0, days.size()).mapToObj(i -> "{" + i + "}").collect(Collectors.joining(","));
                w.apply("DATE(created_at) IN (" + ph + ")", days.toArray());
            }
        }
        // 排序
        boolean asc = "asc".equalsIgnoreCase(request.getSortOrder());
        switch (request.getSortBy() != null ? request.getSortBy() : "units") {
            case "price" -> w.orderBy(true, asc, BrsRankingRaw::getPrice);
            case "bsr" -> w.orderBy(true, asc, BrsRankingRaw::getBsr);
            case "listingDays" -> w.orderBy(true, asc, BrsRankingRaw::getListingDays);
            case "createdAt" -> w.orderBy(true, asc, BrsRankingRaw::getCreatedAt);
            case "rating" -> w.orderBy(true, asc, BrsRankingRaw::getRating);
            case "weightG" -> w.orderBy(true, asc, BrsRankingRaw::getWeightG);
            default -> w.orderBy(true, asc, BrsRankingRaw::getUnits);
        }

        int pageNo = request.getPage() != null ? request.getPage() : 1;
        int size = Math.max(1, Math.min(request.getSize() != null ? request.getSize() : 20, 100));
        long total = brsMapper.selectCount(w);
        w.last("LIMIT " + ((pageNo - 1) * size) + "," + size);
        List<CompetitorProductResponse> list = brsMapper.selectList(w).stream()
                .map(p -> competitorService.toResponse(p, List.of()))
                .collect(Collectors.toList());
        return PageResult.of(list, total, (long) pageNo, (long) size);
    }

    /** 周批次下拉（RangeFilterPanel 用）：按 DATE(created_at) 单天粒度。 */
    public List<Map<String, Object>> getCreatedWeeks(String marketplace) {
        return brsMapper.selectCreatedWeeksWithCount(marketplace, SOURCE);
    }
}
