package com.sjzm.product.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.sjzm.common.PageResult;
import com.sjzm.product.dto.*;
import com.sjzm.product.entity.AiSelectionProduct;
import com.sjzm.product.mapper.AiSelectionMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "features.ai-selection", name = "enabled", havingValue = "true")
public class AiSelectionService {

    private final AiSelectionMapper aiSelectionMapper;
    private final com.sjzm.product.mapper.NonstandardCarrierMapper carrierMapper;

    // ────────────────────────────────────────────────────────
    // 全量捞取（按载体，服务端 INSERT ... SELECT）
    // ────────────────────────────────────────────────────────

    @Transactional(rollbackFor = Exception.class)
    public AiSelectionPushResult harvestByCarrier(String carrierKey, List<String> marketplaces, String userId) {
        if (StringUtils.isBlank(carrierKey) || marketplaces == null || marketplaces.isEmpty()) {
            throw new IllegalArgumentException("carrierKey 和 marketplaces 不能为空");
        }
        // 去空白/去重，保持传入顺序
        List<String> markets = marketplaces.stream()
                .filter(StringUtils::isNotBlank)
                .map(String::trim)
                .distinct()
                .collect(Collectors.toList());
        if (markets.isEmpty()) {
            throw new IllegalArgumentException("站点列表为空");
        }

        // 读载体检索词
        com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<com.sjzm.product.entity.NonstandardCarrier> cw =
                new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<>();
        cw.eq(com.sjzm.product.entity.NonstandardCarrier::getCarrierKey, carrierKey);
        com.sjzm.product.entity.NonstandardCarrier carrier = carrierMapper.selectOne(cw);
        if (carrier == null) {
            throw new IllegalArgumentException("载体不存在: " + carrierKey);
        }

        List<String> titleKeywords = splitCsv(carrier.getTitleKeywords());
        List<String> categoryPaths = splitCsv(carrier.getCategoryPaths());
        List<String> excludeKeywords = splitCsv(carrier.getExcludeKeywords());
        List<String> conditionalExcludeKeywords = splitCsv(carrier.getConditionalExcludeKeywords());
        List<String> includeKeywords = splitCsv(carrier.getIncludeKeywords());
        if (titleKeywords.isEmpty() && categoryPaths.isEmpty()) {
            throw new IllegalArgumentException("载体未配置任何检索词: " + carrierKey);
        }

        // 一个 batchId 贯穿三国：本次「新增」的商品全部归入同一批次
        String batchId = "batch_" + UUID.randomUUID().toString().replace("-", "");
        String today = java.time.LocalDate.now().toString();
        String batchLabel = carrier.getName() + " · " + String.join("/", markets) + " · 增量 " + today;

        // 逐站点 × 双通道，都写同一批次。shop 先、clean 后；
        // harvestFrom* 内已含「相对 载体+站点+ASIN 历史 NOT EXISTS」增量去重，
        // 同事务内 clean 能看到 shop 刚插入行，跨通道/跨站点天然不重。
        int shopTotal = 0;
        int cleanTotal = 0;
        for (String mk : markets) {
            shopTotal += aiSelectionMapper.harvestFromShop(mk, batchId, batchLabel, carrierKey,
                    userId, titleKeywords, categoryPaths, excludeKeywords, conditionalExcludeKeywords, includeKeywords);
            cleanTotal += aiSelectionMapper.harvestFromClean(mk, batchId, batchLabel, carrierKey,
                    userId, titleKeywords, categoryPaths, excludeKeywords, conditionalExcludeKeywords, includeKeywords);
        }
        int total = aiSelectionMapper.countByBatch(batchId);

        log.info("AI 选品增量捞取: carrier={}, marketplaces={}, batchId={}, shop={}, clean={}, 新增(去重后)={}",
                carrierKey, markets, batchId, shopTotal, cleanTotal, total);

        return AiSelectionPushResult.builder()
                .batchId(batchId)
                .batchLabel(batchLabel)
                .total(total)
                .requested(shopTotal + cleanTotal)
                .invalidAsins(Collections.emptyList())
                .products(Collections.emptyList())
                .build();
    }

    private List<String> splitCsv(String csv) {
        if (StringUtils.isBlank(csv)) return Collections.emptyList();
        List<String> out = new ArrayList<>();
        for (String part : csv.split(",")) {
            String t = part.trim();
            if (!t.isEmpty()) out.add(t);
        }
        return out;
    }

    // ────────────────────────────────────────────────────────
    // 分页查询
    // ────────────────────────────────────────────────────────

    public PageResult<AiSelectionProduct> queryPage(AiSelectionQueryRequest request) {
        int pageNum = request.getPage() != null ? request.getPage() : 1;
        int pageSize = request.getSize() != null ? request.getSize() : 60;

        Page<AiSelectionProduct> page = new Page<>(pageNum, pageSize);

        LambdaQueryWrapper<AiSelectionProduct> wrapper = new LambdaQueryWrapper<>();

        // 站点
        if (StringUtils.isNotBlank(request.getMarketplace())) {
            wrapper.eq(AiSelectionProduct::getMarketplace, request.getMarketplace());
        }

        // ASIN 精准查询
        if (request.getAsin() != null && !request.getAsin().isEmpty()) {
            wrapper.in(AiSelectionProduct::getAsin, request.getAsin());
        }

        // 批次过滤（多选）
        if (request.getBatchIds() != null && !request.getBatchIds().isEmpty()) {
            wrapper.in(AiSelectionProduct::getBatchId, request.getBatchIds());
        }

        // 载体过滤（多选）：选挂牌只出挂牌，可多选一起看
        if (request.getCarriers() != null && !request.getCarriers().isEmpty()) {
            wrapper.in(AiSelectionProduct::getCarrier, request.getCarriers());
        }

        // 方法卡快筛（M01/M03）：套用与新品榜/竞品页同口径的门槛到 ai_selection 表
        applyMethodCardFilter(wrapper, request.getMethodId(), request.getMarketplace());

        // 文本搜索
        if (StringUtils.isNotBlank(request.getTitle())) {
            wrapper.like(AiSelectionProduct::getTitle, request.getTitle());
        }
        if (StringUtils.isNotBlank(request.getSellerName())) {
            wrapper.like(AiSelectionProduct::getSellerName, request.getSellerName());
        }
        if (StringUtils.isNotBlank(request.getBrand())) {
            wrapper.like(AiSelectionProduct::getBrand, request.getBrand());
        }
        if (StringUtils.isNotBlank(request.getCategory())) {
            wrapper.eq(AiSelectionProduct::getBsrId, request.getCategory());
        }

        // 类目树
        if (StringUtils.isNotBlank(request.getBsrId())) {
            wrapper.eq(AiSelectionProduct::getBsrId, request.getBsrId());
        }
        if (request.getNodeId() != null) {
            wrapper.eq(AiSelectionProduct::getNodeId, request.getNodeId());
        }

        // 数值区间
        if (request.getPriceMin() != null) {
            wrapper.ge(AiSelectionProduct::getPrice, request.getPriceMin());
        }
        if (request.getPriceMax() != null) {
            wrapper.le(AiSelectionProduct::getPrice, request.getPriceMax());
        }
        if (request.getUnitsMin() != null) {
            wrapper.ge(AiSelectionProduct::getUnits, request.getUnitsMin());
        }
        if (request.getUnitsMax() != null) {
            wrapper.le(AiSelectionProduct::getUnits, request.getUnitsMax());
        }
        if (request.getListingDaysMin() != null) {
            wrapper.ge(AiSelectionProduct::getListingDays, request.getListingDaysMin());
        }
        if (request.getListingDaysMax() != null) {
            wrapper.le(AiSelectionProduct::getListingDays, request.getListingDaysMax());
        }
        if (request.getBsrMax() != null) {
            wrapper.le(AiSelectionProduct::getBsr, request.getBsrMax());
        }
        if (request.getWeightMax() != null) {
            wrapper.le(AiSelectionProduct::getWeightG, request.getWeightMax());
        }
        if (request.getMaxVariantCount() != null) {
            wrapper.le(AiSelectionProduct::getVariations, request.getMaxVariantCount());
        }

        // 配送方式多选
        if (request.getFulfillment() != null && !request.getFulfillment().isEmpty()) {
            wrapper.in(AiSelectionProduct::getFulfillment, request.getFulfillment());
        }

        // 排序
        // 排序字段对齐前端统一口径（salesVolume/listingDate/createdAt），
        // 与竞品/店铺/郑总盘保持一致，避免前端传 salesVolume 却被后端忽略、退化成 pushedAt。
        String sortBy = request.getSortBy() != null ? request.getSortBy() : "pushedAt";
        boolean asc = "asc".equalsIgnoreCase(request.getSortOrder());
        switch (sortBy) {
            case "price" -> wrapper.orderBy(true, asc, AiSelectionProduct::getPrice);
            case "units", "salesVolume" -> wrapper.orderBy(true, asc, AiSelectionProduct::getUnits);
            case "bsr" -> wrapper.orderBy(true, asc, AiSelectionProduct::getBsr);
            case "listingDays" -> wrapper.orderBy(true, asc, AiSelectionProduct::getListingDays);
            // listingDate/availableDate：按上架日期排（available_date），前端「上架时间」即此项
            case "listingDate", "availableDate" -> wrapper.orderBy(true, asc, AiSelectionProduct::getAvailableDate);
            case "rating", "ratings" -> wrapper.orderBy(true, asc, AiSelectionProduct::getRating);
            case "title" -> wrapper.orderBy(true, asc, AiSelectionProduct::getTitle);
            case "createdAt" -> wrapper.orderByDesc(AiSelectionProduct::getPushedAt);
            default -> wrapper.orderByDesc(AiSelectionProduct::getPushedAt);
        }

        // 排除空壳记录
        wrapper.isNotNull(AiSelectionProduct::getTitle);

        IPage<AiSelectionProduct> result = aiSelectionMapper.selectPage(page, wrapper);

        PageResult<AiSelectionProduct> pageResult = new PageResult<>();
        pageResult.setList(result.getRecords());
        pageResult.setTotal(result.getTotal());
        pageResult.setPage((long) pageNum);
        pageResult.setSize((long) pageSize);
        return pageResult;
    }

    /**
     * 方法卡快筛：把 M01/M03 的门槛套到 ai_selection 查询上，语义严格对齐
     * MethodCardMapper.xml 的 M01Where / M03Where，保证与新品榜/竞品页同口径。
     * methodId 为空则不叠加任何门槛（普通查询）。
     */
    private void applyMethodCardFilter(LambdaQueryWrapper<AiSelectionProduct> wrapper,
                                       String methodId, String marketplace) {
        if (StringUtils.isBlank(methodId)) {
            return;
        }
        if ("M01".equalsIgnoreCase(methodId)) {
            com.sjzm.product.methodrule.M01Rule rule =
                    com.sjzm.product.methodrule.M01Rule.forMarketplace(marketplace);
            // 价格区间 + 重量上限 + 上架天数上限（硬门槛）
            wrapper.ge(AiSelectionProduct::getPrice, rule.priceMin())
                    .le(AiSelectionProduct::getPrice, rule.priceMax())
                    .isNotNull(AiSelectionProduct::getWeightG)
                    .lt(AiSelectionProduct::getWeightG, rule.weightMax())
                    .isNotNull(AiSelectionProduct::getListingDays)
                    .lt(AiSelectionProduct::getListingDays, rule.listingDaysMax());
            // 销量上限：已知销量不得超过上限（销量为空仍允许走 BSR 兜底）
            wrapper.and(w -> w.isNull(AiSelectionProduct::getUnits)
                    .or().le(AiSelectionProduct::getUnits, rule.salesMax()));
            // 分档销量（≤30/60/90 各对应门槛，满足任一）或 BSR 达标
            wrapper.and(w -> {
                w.or(x -> x.le(AiSelectionProduct::getListingDays, 30)
                        .isNotNull(AiSelectionProduct::getUnits)
                        .ge(AiSelectionProduct::getUnits, rule.sales30()));
                w.or(x -> x.le(AiSelectionProduct::getListingDays, 60)
                        .isNotNull(AiSelectionProduct::getUnits)
                        .ge(AiSelectionProduct::getUnits, rule.sales60()));
                w.or(x -> x.le(AiSelectionProduct::getListingDays, 90)
                        .isNotNull(AiSelectionProduct::getUnits)
                        .ge(AiSelectionProduct::getUnits, rule.sales90()));
                if (rule.bsrMax() != null) {
                    w.or(x -> x.isNotNull(AiSelectionProduct::getBsr)
                            .gt(AiSelectionProduct::getBsr, 0)
                            .lt(AiSelectionProduct::getBsr, rule.bsrMax()));
                }
            });
        } else if ("M03".equalsIgnoreCase(methodId)) {
            com.sjzm.product.methodrule.M03Rule rule =
                    com.sjzm.product.methodrule.M03Rule.forMarketplace(marketplace);
            // fulfillment=FBM（大小写不敏感）+ 上架<90天 + 90天销量≥门槛
            wrapper.apply("UPPER(TRIM(fulfillment)) = {0}", "FBM")
                    .isNotNull(AiSelectionProduct::getListingDays)
                    .lt(AiSelectionProduct::getListingDays, rule.listingDaysMax())
                    .isNotNull(AiSelectionProduct::getUnits)
                    .ge(AiSelectionProduct::getUnits, rule.sales90());
        }
        // 其他 methodId（含 M02 郑总盘专属）不适用于 ai_selection，忽略
    }

    // ────────────────────────────────────────────────────────
    // 投递 / 导入
    // ────────────────────────────────────────────────────────

    @Transactional(rollbackFor = Exception.class)
    public AiSelectionPushResult push(AiSelectionPushRequest request, String userId) {
        String batchId = "batch_" + UUID.randomUUID().toString().replace("-", "");
        String batchLabel = request.getBatchLabel() != null ? request.getBatchLabel() : "";
        String marketplace = request.getMarketplace();
        // 整批统一投递时间，保证同批次各行 pushed_at 一致（批次聚合/排序按批次而非按行）
        LocalDateTime pushedAt = LocalDateTime.now();

        List<AiSelectionProduct> toInsert = new ArrayList<>();
        List<String> invalidAsins = new ArrayList<>();

        for (String asin : request.getAsins()) {
            if (StringUtils.isBlank(asin)) continue;
            String trimmedAsin = asin.trim().toUpperCase();

            // 第 1 优先：shop_products
            Map<String, Object> row = aiSelectionMapper.lookupFromShop(trimmedAsin, marketplace);
            String sourceRef = "shop_products";

            // 第 2 优先：competitor_products_clean
            if (row == null || row.isEmpty()) {
                row = aiSelectionMapper.lookupFromClean(trimmedAsin, marketplace);
                sourceRef = "competitor_products_clean";
            }

            if (row == null || row.isEmpty()) {
                invalidAsins.add(trimmedAsin);
                continue;
            }

            AiSelectionProduct entity = mapToEntity(row, batchId, batchLabel, sourceRef, userId, pushedAt);
            toInsert.add(entity);
        }

        // 批量写入
        int inserted = 0;
        if (!toInsert.isEmpty()) {
            inserted = aiSelectionMapper.insertBatchIgnoreDup(toInsert);
        }

        // 构建返回概览（最多 20 条）
        List<AiSelectionProductBrief> briefs = toInsert.stream()
                .limit(20)
                .map(p -> AiSelectionProductBrief.builder()
                        .asin(p.getAsin())
                        .title(p.getTitle())
                        .imageUrl(p.getImageUrl())
                        .marketplace(p.getMarketplace())
                        .sourceRef(p.getSourceRef())
                        .batchId(p.getBatchId())
                        .build())
                .collect(Collectors.toList());

        log.info("AI 选品投递完成: batchId={}, 成功={}, 无效={}", batchId, inserted, invalidAsins.size());

        return AiSelectionPushResult.builder()
                .batchId(batchId)
                .batchLabel(batchLabel)
                .total(inserted)
                .requested(request.getAsins().size())
                .invalidAsins(invalidAsins)
                .products(briefs)
                .build();
    }

    // ────────────────────────────────────────────────────────
    // 批次列表
    // ────────────────────────────────────────────────────────

    public List<AiSelectionBatchInfo> getBatches(String marketplace) {
        if (StringUtils.isBlank(marketplace)) {
            return Collections.emptyList();
        }
        List<Map<String, Object>> rows = aiSelectionMapper.selectBatches(marketplace);
        List<AiSelectionBatchInfo> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Object count = row.get("product_count");
            result.add(AiSelectionBatchInfo.builder()
                    .batchId((String) row.get("batch_id"))
                    .batchLabel((String) row.get("batch_label"))
                    .pushedBy((String) row.get("pushed_by"))
                    .pushedAt(row.get("pushed_at") != null
                            ? LocalDateTime.parse(row.get("pushed_at").toString().replace(" ", "T"))
                            : null)
                    .productCount(count instanceof Number ? ((Number) count).intValue() : 0)
                    .build());
        }
        return result;
    }

    // ────────────────────────────────────────────────────────
    // 大类目统计
    // ────────────────────────────────────────────────────────

    public List<Map<String, Object>> getCategories(String marketplace, List<String> batchIds) {
        return aiSelectionMapper.selectCategories(marketplace, batchIds);
    }

    // ────────────────────────────────────────────────────────
    // 删除批次
    // ────────────────────────────────────────────────────────

    @Transactional(rollbackFor = Exception.class)
    public int deleteBatch(String batchId) {
        LambdaQueryWrapper<AiSelectionProduct> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(AiSelectionProduct::getBatchId, batchId);
        return aiSelectionMapper.delete(wrapper);
    }

    // ────────────────────────────────────────────────────────
    // 内部工具
    // ────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private AiSelectionProduct mapToEntity(Map<String, Object> row, String batchId,
                                            String batchLabel, String sourceRef, String userId,
                                            LocalDateTime pushedAt) {
        AiSelectionProduct p = new AiSelectionProduct();
        p.setBatchId(batchId);
        p.setBatchLabel(batchLabel);
        p.setSourceRef(sourceRef);
        p.setPushedBy(userId);
        p.setPushedAt(pushedAt);

        // 基础字段
        p.setAsin(getStr(row, "asin"));
        p.setMarketplace(getStr(row, "marketplace"));
        p.setMonth(getStr(row, "month"));
        p.setTitle(getStr(row, "title"));
        p.setBrand(getStr(row, "brand"));
        p.setBrandUrl(getStr(row, "brand_url"));
        p.setImageUrl(getStr(row, "image_url"));
        p.setParentAsin(getStr(row, "parent_asin"));
        p.setSku(getStr(row, "sku"));
        p.setNodeId(getLong(row, "node_id"));
        p.setNodeIdPath(getStr(row, "node_id_path"));
        p.setNodeLabelPath(getStr(row, "node_label_path"));
        p.setSymbol(getStr(row, "symbol"));

        // 销量
        p.setUnits(getInt(row, "units"));
        p.setSalesTier(getStr(row, "sales_tier"));
        p.setUnitsGr(getDecimal(row, "units_gr"));
        p.setAmzUnit(getInt(row, "amz_unit"));
        p.setAmzSales(getDecimal(row, "amz_sales"));
        p.setAmzUnitDate(getLong(row, "amz_unit_date"));
        p.setRevenue(getDecimal(row, "revenue"));

        // BSR
        p.setBsrId(getStr(row, "bsr_id"));
        p.setBsr(getInt(row, "bsr"));
        p.setBsrCr(getDecimal(row, "bsr_cr"));
        p.setBsrCv(getInt(row, "bsr_cv"));

        // 评分
        p.setRatings(getInt(row, "ratings"));
        p.setRating(getDecimal(row, "rating"));
        p.setRatingsRate(getDecimal(row, "ratings_rate"));
        p.setRatingsCv(getInt(row, "ratings_cv"));
        p.setRatingDelta(getInt(row, "rating_delta"));

        // 价格
        p.setPrice(getDecimal(row, "price"));
        p.setPrimePrice(getDecimal(row, "prime_price"));
        p.setProfit(getDecimal(row, "profit"));
        p.setFba(getDecimal(row, "fba"));
        p.setDeliveryPrice(getDecimal(row, "delivery_price"));

        // 卖家
        p.setSellerName(getStr(row, "seller_name"));
        p.setSellerId(getStr(row, "seller_id"));
        p.setSellerNation(getStr(row, "seller_nation"));
        p.setSellers(getInt(row, "sellers"));

        // 物流/变体
        p.setFulfillment(getStr(row, "fulfillment"));
        p.setVariations(getInt(row, "variations"));
        p.setWeight(getStr(row, "weight"));
        p.setDimension(getStr(row, "dimension"));
        p.setDimensionsType(getStr(row, "dimensions_type"));
        p.setPkgDimensions(getStr(row, "pkg_dimensions"));
        p.setPkgDimensionType(getStr(row, "pkg_dimension_type"));
        p.setPkgWeight(getStr(row, "pkg_weight"));

        p.setLqs(getDecimal(row, "lqs"));
        p.setAvailableDate(getLong(row, "available_date"));

        // 标签
        p.setBestSeller(getStr(row, "best_seller"));
        p.setAmazonChoice(getStr(row, "amazon_choice"));
        p.setNewRelease(getStr(row, "new_release"));
        p.setEbc(getStr(row, "ebc"));
        p.setVideo(getStr(row, "video"));

        // 筛选衍生
        p.setFilterMode(getStr(row, "filter_mode"));
        p.setFilterReasons(getStr(row, "filter_reasons"));
        p.setListingDays(getInt(row, "listing_days"));
        p.setWeightG(getDecimal(row, "weight_g"));
        p.setProductUrl(getStr(row, "product_url"));
        p.setSimilarUrl(getStr(row, "similar_url"));
        p.setSource(getStr(row, "source"));

        // 评分等级
        p.setScore(getInt(row, "score"));
        p.setGrade(getStr(row, "grade"));
        p.setWeekTag(getStr(row, "week_tag"));
        p.setIsCurrent(getInt(row, "is_current"));
        p.setM01Active(getInt(row, "m01_active"));

        return p;
    }

    private String getStr(Map<String, Object> row, String key) {
        Object v = row.get(key);
        return v != null ? v.toString() : null;
    }

    private Integer getInt(Map<String, Object> row, String key) {
        Object v = row.get(key);
        if (v == null) return null;
        if (v instanceof Number) return ((Number) v).intValue();
        try { return Integer.parseInt(v.toString()); } catch (Exception e) { return null; }
    }

    private Long getLong(Map<String, Object> row, String key) {
        Object v = row.get(key);
        if (v == null) return null;
        if (v instanceof Number) return ((Number) v).longValue();
        try { return Long.parseLong(v.toString()); } catch (Exception e) { return null; }
    }

    private BigDecimal getDecimal(Map<String, Object> row, String key) {
        Object v = row.get(key);
        if (v == null) return null;
        if (v instanceof BigDecimal) return (BigDecimal) v;
        if (v instanceof Number) return BigDecimal.valueOf(((Number) v).doubleValue());
        try { return new BigDecimal(v.toString()); } catch (Exception e) { return null; }
    }
}
