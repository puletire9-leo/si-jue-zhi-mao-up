package com.sjzm.product.modules.shopcollection.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.sjzm.common.PageResult;
import com.sjzm.product.methodrule.M01Rule;
import com.sjzm.product.methodrule.M03Rule;
import com.sjzm.product.modules.analysisbaseline.common.MarketplaceSupport;
import com.sjzm.product.modules.analysisbaseline.shopprofile.dto.ShopProfileProduct;
import com.sjzm.product.modules.analysisbaseline.shopprofile.dto.ShopProfileSummary;
import com.sjzm.product.modules.analysisbaseline.shopprofile.mapper.ShopProfileMapper;
import com.sjzm.product.modules.shopcandidate.entity.ShopFetchRun;
import com.sjzm.product.modules.shopcandidate.mapper.ShopFetchRunMapper;
import com.sjzm.product.modules.shopcollection.dto.ShopAgeBucketStat;
import com.sjzm.product.modules.shopcollection.dto.ShopCategoryInsight;
import com.sjzm.product.modules.shopcollection.dto.ShopCategoryRiskInsight;
import com.sjzm.product.modules.shopcollection.dto.ShopCollectionDetail;
import com.sjzm.product.modules.shopcollection.dto.ShopCollectionInsight;
import com.sjzm.product.modules.shopcollection.dto.ShopProductSelectionQuery;
import com.sjzm.product.modules.shopcollection.dto.ShopMatrix;
import com.sjzm.product.modules.shopcollection.dto.ShopMatrixCell;
import com.sjzm.product.modules.shopcollection.dto.ShopSnapshot;
import com.sjzm.product.modules.shopcollection.dto.ShopTierAgeCategoryCell;
import com.sjzm.product.modules.shopcollection.dto.ShopTierInsight;
import com.sjzm.product.modules.shopcollection.entity.ShopProduct;
import com.sjzm.product.modules.shopcollection.entity.ShopWatchlist;
import com.sjzm.product.modules.shopcollection.mapper.ShopProductMapper;
import com.sjzm.product.modules.shopcollection.mapper.ShopWatchlistMapper;
import com.sjzm.product.modules.shopcollection.rule.ShopProfileLabelRule;
import com.sjzm.product.modules.shopcollection.rule.ShopProfileLabelRule.CategoryLabel;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.*;
import java.util.stream.Collectors;

/**
 * 店铺全集读侧聚合：单店全景详情 + 全集商品分页 + 快照选择 + 商品墙 + 历史对比。
 * 读的是 shop_products（观察池抓来的店铺全集），复用店铺画像的父体去重/tier/类目 SQL。
 */
@Service
@RequiredArgsConstructor
public class ShopCollectionService {

    private final ShopProfileMapper shopProfileMapper;
    private final ShopProductMapper shopProductMapper;
    private final ShopWatchlistMapper watchlistMapper;
    private final ShopFetchRunMapper fetchRunMapper;
    private final ShopProfileLabelRule labelRule;

    private static final Set<String> SUCCESS_STATUSES = Set.of("SUCCESS", "PARTIAL_SUCCESS");

    private static final List<String> TIER_ORDER = List.of("A", "B", "C", "D", "UNKNOWN");
    private static final List<String> AGE_ORDER = List.of("NEW", "GROWING", "MATURE", "OLD", "UNKNOWN");
    private static final List<String> ATTENTION_ORDER =
            List.of("GOOD_TENDENCY", "NEUTRAL", "ATTENTION_REVIEW", "ATTENTION_STRONG", "UNKNOWN");

    // ========================================================================
    //  快照解析与列表
    // ========================================================================

    /**
     * 解析快照：优先 sourceRunId → batchCode → 最新成功记录。
     * 只查 status IN ('SUCCESS', 'PARTIAL_SUCCESS')。
     */
    public ShopSnapshot resolveSnapshot(String marketplace, String sellerName, String sourceRunId, String batchCode) {
        String mp = MarketplaceSupport.require(marketplace);
        String seller = requireText(sellerName, "sellerName 不能为空");

        ShopFetchRun run;
        if (StringUtils.hasText(sourceRunId)) {
            run = resolveSourceRunSnapshot(mp, seller, sourceRunId.trim());
        } else if (StringUtils.hasText(batchCode)) {
            LambdaQueryWrapper<ShopFetchRun> qw = new LambdaQueryWrapper<ShopFetchRun>()
                    .eq(ShopFetchRun::getMarketplace, mp)
                    .eq(ShopFetchRun::getSellerName, seller)
                    .eq(ShopFetchRun::getBatchCode, batchCode.trim())
                    .in(ShopFetchRun::getStatus, SUCCESS_STATUSES)
                    .orderByDesc(ShopFetchRun::getStartedAt)
                    .last("LIMIT 1");
            run = fetchRunMapper.selectOne(qw);
            if (run == null) {
                throw new IllegalArgumentException("未找到该批次的成功快照: marketplace=" + mp
                        + ", sellerName=" + seller + ", batchCode=" + batchCode);
            }
        } else {
            LambdaQueryWrapper<ShopFetchRun> qw = new LambdaQueryWrapper<ShopFetchRun>()
                    .eq(ShopFetchRun::getMarketplace, mp)
                    .eq(ShopFetchRun::getSellerName, seller)
                    .in(ShopFetchRun::getStatus, SUCCESS_STATUSES)
                    .orderByDesc(ShopFetchRun::getStartedAt)
                    .last("LIMIT 1");
            run = fetchRunMapper.selectOne(qw);
            if (run == null) {
                throw new IllegalArgumentException("该店铺尚无成功快照: marketplace=" + mp + ", sellerName=" + seller);
            }
        }

        return new ShopSnapshot(
                run.getRunId(),
                run.getBatchCode(),
                run.getBatchDate(),
                run.getMarketplace(),
                run.getSellerName(),
                run.getTotal(),
                run.getFetchedCount(),
                run.getWrittenCount(),
                run.getApiCalls()
        );
    }

    private ShopFetchRun resolveSourceRunSnapshot(String marketplace, String sellerName, String sourceRunId) {
        ShopFetchRun run = fetchRunMapper.selectById(sourceRunId);
        if (run == null) {
            throw new IllegalArgumentException("快照记录不存在: " + sourceRunId);
        }
        if (!SUCCESS_STATUSES.contains(run.getStatus())) {
            throw new IllegalArgumentException("快照不是成功状态: sourceRunId=" + sourceRunId + ", status=" + run.getStatus());
        }
        if (!marketplace.equals(run.getMarketplace())) {
            throw new IllegalArgumentException("快照站点不匹配: sourceRunId=" + sourceRunId
                    + ", expected=" + marketplace + ", actual=" + run.getMarketplace());
        }
        if (StringUtils.hasText(sellerName) && !sellerName.equals(run.getSellerName())) {
            throw new IllegalArgumentException("快照店铺不匹配: sourceRunId=" + sourceRunId
                    + ", expected=" + sellerName + ", actual=" + run.getSellerName());
        }
        return run;
    }

    /** 该店铺所有成功快照列表，按 batch_code 降序。 */
    public List<ShopSnapshot> snapshots(String marketplace, String sellerName) {
        String mp = MarketplaceSupport.require(marketplace);
        String seller = requireText(sellerName, "sellerName 不能为空");

        LambdaQueryWrapper<ShopFetchRun> qw = new LambdaQueryWrapper<ShopFetchRun>()
                .eq(ShopFetchRun::getMarketplace, mp)
                .eq(ShopFetchRun::getSellerName, seller)
                .in(ShopFetchRun::getStatus, SUCCESS_STATUSES)
                .orderByDesc(ShopFetchRun::getBatchCode, ShopFetchRun::getStartedAt);
        List<ShopFetchRun> runs = fetchRunMapper.selectList(qw);

        return runs.stream()
                .map(r -> new ShopSnapshot(
                        r.getRunId(), r.getBatchCode(), r.getBatchDate(),
                        r.getMarketplace(), r.getSellerName(),
                        r.getTotal(), r.getFetchedCount(), r.getWrittenCount(), r.getApiCalls()))
                .collect(Collectors.toList());
    }

    // ========================================================================
    //  商品墙（图片主导，按销量等级分区）
    // ========================================================================

    /**
     * 商品墙：解析快照后，从 shop_products 查该 snapshot 下的商品。
     * 如果传了 salesTier 则只查该等级，否则按 A/B/C/D/UNKNOWN 分区返回。
     */
    public Map<String, Object> productWall(String marketplace, String sellerName,
                                           String sourceRunId, String batchCode, String salesTier,
                                           Integer page, Integer size) {
        String mp = MarketplaceSupport.require(marketplace);
        String seller = requireText(sellerName, "sellerName 不能为空");
        ShopSnapshot snapshot = resolveSnapshot(mp, seller, sourceRunId, batchCode);
        int safePage = Math.max(1, page == null ? 1 : page);
        int safeSize = Math.max(1, Math.min(size == null ? 24 : size, 100));

        LambdaQueryWrapper<ShopProduct> qw = new LambdaQueryWrapper<ShopProduct>()
                .eq(ShopProduct::getMarketplace, mp)
                .eq(ShopProduct::getSellerName, seller)
                .eq(ShopProduct::getSourceRunId, snapshot.sourceRunId())
                .isNotNull(ShopProduct::getAsin);

        String tier = normalizeSalesTier(salesTier);
        if (tier != null) {
            qw.eq(ShopProduct::getSalesTier, tier);
        }

        List<ShopProduct> allProducts = shopProductMapper.selectList(qw);
        allProducts.sort(Comparator
                .comparing((ShopProduct p) -> tierSortRank(defaultTier(p.getSalesTier())))
                .thenComparing(p -> p.getUnits() == null ? Integer.MIN_VALUE : p.getUnits(), Comparator.reverseOrder())
                .thenComparing(p -> p.getAsin() == null ? "" : p.getAsin()));

        // 按 salesTier 分组
        Map<String, List<Map<String, Object>>> tierMap = new LinkedHashMap<>();
        for (String t : new String[]{"A", "B", "C", "D", "UNKNOWN"}) {
            tierMap.put(t, new ArrayList<>());
        }

        for (ShopProduct p : allProducts) {
            String st = p.getSalesTier();
            if (st == null || !tierMap.containsKey(st)) {
                st = "UNKNOWN";
            }
            tierMap.get(st).add(toProductWallItem(p));
        }

        Map<String, Object> sections = new LinkedHashMap<>();
        for (String t : new String[]{"A", "B", "C", "D", "UNKNOWN"}) {
            List<Map<String, Object>> products = tierMap.get(t);
            Map<String, Object> section = new LinkedHashMap<>();
            section.put("count", products.size());
            section.put("page", safePage);
            section.put("size", safeSize);
            section.put("products", paginateList(products, safePage, safeSize));
            sections.put(t, section);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("snapshot", snapshot);
        result.put("sections", sections);
        return result;
    }

    private int tierSortRank(String tier) {
        return switch (tier) {
            case "A" -> 1;
            case "B" -> 2;
            case "C" -> 3;
            case "D" -> 4;
            default -> 5;
        };
    }

    private <T> List<T> paginateList(List<T> list, int page, int size) {
        int from = (page - 1) * size;
        if (from >= list.size()) {
            return Collections.emptyList();
        }
        int to = Math.min(from + size, list.size());
        return list.subList(from, to);
    }

    /** 把 ShopProduct 转成商品墙条目 Map（只暴露必要字段）。 */
    private Map<String, Object> toProductWallItem(ShopProduct p) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("asin", p.getAsin());
        item.put("parentAsin", p.getParentAsin());
        item.put("imageUrl", p.getImageUrl());
        item.put("title", p.getTitle());
        item.put("units", p.getUnits());
        item.put("salesTier", p.getSalesTier());
        item.put("price", p.getPrice());
        item.put("rating", p.getRating());
        item.put("ratings", p.getRatings());
        item.put("nodeLabelPath", p.getNodeLabelPath());
        item.put("productUrl", p.getProductUrl());
        return item;
    }

    private Map<String, Object> toProductWallItem(ShopProfileProduct p) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("asin", p.getAsin());
        item.put("parentAsin", p.getParentAsin());
        item.put("imageUrl", p.getImageUrl());
        item.put("title", p.getTitle());
        item.put("units", p.getUnits());
        item.put("salesTier", p.getSalesTier());
        item.put("price", p.getPrice());
        item.put("rating", p.getRating());
        item.put("ratings", p.getRatings());
        item.put("nodeLabelPath", p.getNodeLabelPath());
        item.put("productUrl", p.getProductUrl());
        return item;
    }

    // ========================================================================
    //  单店历史对比
    // ========================================================================

    /**
     * 单店历史对比：两个快照的新增/消失/保留/等级变化。
     * 商品 key = COALESCE(parent_asin, asin)。
     */
    public Map<String, Object> compare(String marketplace, String sellerName,
                                       String baselineRunId, String compareRunId,
                                       Integer page, Integer size) {
        String mp = MarketplaceSupport.require(marketplace);
        String seller = requireText(sellerName, "sellerName cannot be blank");

        ShopSnapshot baseline = resolveSnapshot(mp, seller, baselineRunId, null);
        ShopSnapshot compare = resolveSnapshot(mp, seller, compareRunId, null);

        int safeSize = Math.max(1, Math.min(size == null ? 60 : size, 200));
        int safePage = Math.max(1, page == null ? 1 : page);
        int offset = (safePage - 1) * safeSize;

        long newCount = countCompareProducts(mp, seller, baseline.sourceRunId(), compare.sourceRunId(), "NEW");
        long goneCount = countCompareProducts(mp, seller, baseline.sourceRunId(), compare.sourceRunId(), "GONE");
        long keptCount = countCompareProducts(mp, seller, baseline.sourceRunId(), compare.sourceRunId(), "KEPT");
        long upgradedCount = countCompareProducts(mp, seller, baseline.sourceRunId(), compare.sourceRunId(), "UPGRADED");
        long downgradedCount = countCompareProducts(mp, seller, baseline.sourceRunId(), compare.sourceRunId(), "DOWNGRADED");

        List<Map<String, Object>> newProducts = compareProductsPage(mp, seller, baseline.sourceRunId(), compare.sourceRunId(), "NEW", offset, safeSize);
        List<Map<String, Object>> goneProducts = compareProductsPage(mp, seller, baseline.sourceRunId(), compare.sourceRunId(), "GONE", offset, safeSize);
        List<Map<String, Object>> keptProducts = compareProductsPage(mp, seller, baseline.sourceRunId(), compare.sourceRunId(), "KEPT", offset, safeSize);
        List<Map<String, Object>> upgradedProducts = compareProductsPage(mp, seller, baseline.sourceRunId(), compare.sourceRunId(), "UPGRADED", offset, safeSize);
        List<Map<String, Object>> downgradedProducts = compareProductsPage(mp, seller, baseline.sourceRunId(), compare.sourceRunId(), "DOWNGRADED", offset, safeSize);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("baseline", Map.of(
                "sourceRunId", baseline.sourceRunId(),
                "batchCode", baseline.batchCode(),
                "batchDate", baseline.batchDate()));
        result.put("compare", Map.of(
                "sourceRunId", compare.sourceRunId(),
                "batchCode", compare.batchCode(),
                "batchDate", compare.batchDate()));
        result.put("summary", Map.of(
                "newCount", newCount,
                "goneCount", goneCount,
                "keptCount", keptCount,
                "upgradedCount", upgradedCount,
                "downgradedCount", downgradedCount));
        result.put("newProducts", newProducts);
        result.put("goneProducts", goneProducts);
        result.put("keptProducts", keptProducts);
        result.put("upgradedProducts", upgradedProducts);
        result.put("downgradedProducts", downgradedProducts);
        return result;
    }

    private long countCompareProducts(String marketplace, String sellerName, String baselineRunId,
                                      String compareRunId, String changeType) {
        return shopProfileMapper.countCompareProducts(marketplace, sellerName, baselineRunId, compareRunId, changeType);
    }

    private List<Map<String, Object>> compareProductsPage(String marketplace, String sellerName, String baselineRunId,
                                                          String compareRunId, String changeType, int offset, int size) {
        return shopProfileMapper.selectCompareProducts(marketplace, sellerName, baselineRunId, compareRunId, changeType, offset, size)
                .stream()
                .map(this::toProductWallItem)
                .collect(Collectors.toList());
    }

    /** 加载某次快照的商品集合，按 product_key 索引。 */
    private Map<String, ShopProduct> loadProductMap(String marketplace, String sellerName, String sourceRunId) {
        LambdaQueryWrapper<ShopProduct> qw = new LambdaQueryWrapper<ShopProduct>()
                .eq(ShopProduct::getMarketplace, marketplace)
                .eq(ShopProduct::getSellerName, sellerName)
                .eq(ShopProduct::getSourceRunId, sourceRunId)
                .isNotNull(ShopProduct::getAsin);
        List<ShopProduct> products = shopProductMapper.selectList(qw);
        Map<String, ShopProduct> map = new HashMap<>();
        for (ShopProduct p : products) {
            String key = productKey(p);
            // 同一 key 可能有多个变体，保留第一个
            map.putIfAbsent(key, p);
        }
        return map;
    }

    /** 商品去重 key = COALESCE(parent_asin, asin)。 */
    private String productKey(ShopProduct p) {
        String pa = p.getParentAsin();
        return StringUtils.hasText(pa) ? pa.trim() : p.getAsin();
    }

    /** 默认 tier：null 或空视为 UNKNOWN。 */
    private String defaultTier(String tier) {
        return StringUtils.hasText(tier) ? tier : "UNKNOWN";
    }

    /** 比较两个 tier 的升降。A > B > C > D > UNKNOWN。返回正数=cTier更高，负数=cTier更低。 */
    private int compareTier(String cTier, String bTier) {
        int c = tierRank(cTier);
        int b = tierRank(bTier);
        return Integer.compare(c, b);
    }

    private int tierRank(String tier) {
        return switch (tier) {
            case "A" -> 5;
            case "B" -> 4;
            case "C" -> 3;
            case "D" -> 2;
            default -> 1; // UNKNOWN
        };
    }

    /** 对 key 集合按照 compareMap 中的商品数据，做 limit/offset 分页并转成 Map 列表。 */
    private List<Map<String, Object>> paginateKeys(Set<String> keys, Map<String, ShopProduct> productMap,
                                                   int page, int size) {
        List<String> sortedKeys = new ArrayList<>(keys);
        Collections.sort(sortedKeys);
        int total = sortedKeys.size();
        int from = (page - 1) * size;
        if (from >= total) return Collections.emptyList();
        int to = Math.min(from + size, total);
        List<Map<String, Object>> result = new ArrayList<>();
        for (int i = from; i < to; i++) {
            ShopProduct p = productMap.get(sortedKeys.get(i));
            if (p != null) {
                result.add(toProductWallItem(p));
            }
        }
        return result;
    }

    // ========================================================================
    //  单店全景 + 全集列表（原方法，支持 sourceRunId）
    // ========================================================================

    /** 单店全景：观察池进入原因 + 全集 A/B/C/D 画像 + 类目结构。 */
    public ShopCollectionInsight insight(String marketplace, String sellerName, String sourceRunId, String batchCode) {
        String mp = MarketplaceSupport.require(marketplace);
        String seller = requireText(sellerName, "sellerName cannot be blank");
        ShopSnapshot snapshot = resolveSnapshot(mp, seller, sourceRunId, batchCode);
        M01Rule rule = M01Rule.forMarketplace(mp);

        ShopProfileSummary profile = shopProfileMapper.selectShopInsightOverviewFromShopProducts(
                mp, seller, snapshot.batchDate(), snapshot.sourceRunId(),
                rule.priceMin(), rule.priceMax(), rule.weightMax(), rule.listingDaysMax(),
                rule.sales30(), rule.sales60(), rule.sales90(), rule.bsrMax());
        if (profile == null) {
            throw new IllegalArgumentException("shop snapshot has no product rows: marketplace=" + mp
                    + ", sellerName=" + seller + ", sourceRunId=" + snapshot.sourceRunId());
        }
        completeSummary(profile);

        List<ShopTierInsight> tierStats = shopProfileMapper.selectTierInsightsFromShopProducts(
                mp, seller, snapshot.batchDate(), snapshot.sourceRunId(),
                rule.priceMin(), rule.priceMax(), rule.weightMax(), rule.listingDaysMax(),
                rule.sales30(), rule.sales60(), rule.sales90(), rule.bsrMax());
        List<ShopCategoryInsight> categoryStats = shopProfileMapper.selectCategoryInsightsFromShopProducts(
                mp, seller, snapshot.batchDate(), snapshot.sourceRunId(),
                rule.priceMin(), rule.priceMax(), rule.weightMax(), rule.listingDaysMax(),
                rule.sales30(), rule.sales60(), rule.sales90(), rule.bsrMax());

        categoryStats.forEach(this::attachRisk);

        List<ShopTierAgeCategoryCell> cells = shopProfileMapper.selectTierAgeCategoryCellsFromShopProducts(
                mp, seller, snapshot.batchDate(), snapshot.sourceRunId(),
                rule.priceMin(), rule.priceMax(), rule.weightMax(), rule.listingDaysMax(),
                rule.sales30(), rule.sales60(), rule.sales90(), rule.bsrMax());
        cells.forEach(this::attachCellAttention);

        ShopCollectionInsight insight = new ShopCollectionInsight();
        insight.setSnapshot(snapshot);
        insight.setProfile(profile);
        insight.setMethodId("M01");
        insight.setM01HitCount(nvl(profile.getM01HitCount()));
        insight.setM01HitRatio(profile.getM01HitRatio());
        insight.setEarliestAvailableDate(profile.getEarliestAvailableDate());
        insight.setEarliestAvailableDateText(profile.getEarliestAvailableDateText());
        insight.setMaxListingDays(profile.getMaxListingDays());
        insight.setAvgListingDays(profile.getAvgListingDays());
        insight.setAvgUnits(profile.getAvgUnits());
        insight.setNew30Count(nvl(profile.getNew30Count()));
        insight.setNew90Count(nvl(profile.getNew90Count()));
        insight.setNew180Count(nvl(profile.getNew180Count()));
        insight.setOld180Count(nvl(profile.getOld180Count()));
        insight.setUnknownListingDaysCount(nvl(profile.getUnknownListingDaysCount()));
        insight.setTierStats(tierStats);
        insight.setCategoryStats(categoryStats);
        insight.setAgeBucketStats(buildAgeBucketStats(cells));
        insight.setSalesAgeMatrix(buildMatrix(cells, "SALES_AGE"));
        insight.setSalesAttentionMatrix(buildMatrix(cells, "SALES_ATTENTION"));
        insight.setAgeAttentionMatrix(buildMatrix(cells, "AGE_ATTENTION"));
        insight.setTopGoodTendencyCategories(topCategoriesByAttention(cells, true));
        insight.setTopAttentionCategories(topCategoriesByAttention(cells, false));
        String type3d = resolveShopProfile3dType(profile, cells);
        insight.setShopProfile3dType(type3d);
        insight.setShopProfile3dExplanation(explainShopProfile3dType(type3d));
        List<ShopCategoryRiskInsight> labelStats = buildCategoryLabelStats(categoryStats);
        insight.setCategoryLabelStats(labelStats);
        insight.setRiskStats(labelStats);
        return insight;
    }

    public ShopCollectionDetail detail(String marketplace, String sellerName, String batchDate, String sourceRunId) {
        String mp = MarketplaceSupport.require(marketplace);
        String seller = requireText(sellerName, "sellerName 不能为空");

        // 如果传了 sourceRunId，用它解析出 batchDate
        String resolvedSourceRunId = null;
        if (StringUtils.hasText(sourceRunId)) {
            ShopSnapshot snapshot = resolveSnapshot(mp, seller, sourceRunId.trim(), null);
            batchDate = snapshot.batchDate();
            resolvedSourceRunId = snapshot.sourceRunId();
        }

        String bd = resolveBatchDate(mp, batchDate);

        ShopCollectionDetail detail = new ShopCollectionDetail();

        LambdaQueryWrapper<ShopWatchlist> wlQw = new LambdaQueryWrapper<ShopWatchlist>()
                .eq(ShopWatchlist::getMarketplace, mp)
                .eq(ShopWatchlist::getSellerName, seller)
                .orderByDesc(ShopWatchlist::getUpdatedAt);
        detail.setWatchlistEntries(watchlistMapper.selectList(wlQw));

        List<ShopProfileSummary> summaries = selectSummaryFromShopProducts(mp, bd, resolvedSourceRunId, seller, null, 50);
        ShopProfileSummary profile = summaries.stream()
                .filter(s -> seller.equals(s.getSellerName()))
                .findFirst()
                .orElse(null);
        if (profile != null) {
            completeSummary(profile);
        }
        detail.setProfile(profile);
        detail.setCategories(shopProfileMapper.selectCategoriesFromShopProducts(mp, seller, bd, resolvedSourceRunId, null));
        return detail;
    }

    /** 店铺全集列表（按店铺聚合画像）。支持 sourceRunId 参数（优先于 batchDate）。 */
    public List<ShopProfileSummary> summary(String marketplace, String batchDate, String sellerNameKeyword,
                                            Integer minProductCount, Integer limit, String sourceRunId) {
        String mp = MarketplaceSupport.require(marketplace);
        String resolvedSourceRunId = null;

        // 如果传了 sourceRunId，需要先解析出 marketplace+sellerName 和 batchDate
        if (StringUtils.hasText(sourceRunId)) {
            ShopFetchRun run = resolveSourceRunSnapshot(mp, blankToNull(sellerNameKeyword), sourceRunId.trim());
            ShopSnapshot snapshot = new ShopSnapshot(
                    run.getRunId(), run.getBatchCode(), run.getBatchDate(), run.getMarketplace(), run.getSellerName(),
                    run.getTotal(), run.getFetchedCount(), run.getWrittenCount(), run.getApiCalls());
            batchDate = snapshot.batchDate();
            sellerNameKeyword = snapshot.sellerName();
            resolvedSourceRunId = snapshot.sourceRunId();
        }

        String bd = resolveBatchDate(mp, batchDate);
        int lim = limit == null || limit < 1 ? 100 : Math.min(limit, 1000);
        List<ShopProfileSummary> list = selectSummaryFromShopProducts(
                mp, bd, resolvedSourceRunId, blankToNull(sellerNameKeyword), minProductCount, lim);
        list.forEach(this::completeSummary);
        enrichSummary3d(mp, bd, resolvedSourceRunId, list);
        return list;
    }

    public List<ShopProfileSummary> selectionShops(String marketplace, String batchDate, String sellerNameKeyword,
                                                   Integer minProductCount, Integer minM01HitCount,
                                                   Integer minNew90Count, Integer minGoodTendencyCount,
                                                   Integer maxAttentionStrongCount, Integer limit, String sourceRunId) {
        int finalLimit = limit == null || limit < 1 ? 100 : Math.min(limit, 1000);
        int m01Min = minM01HitCount == null ? 0 : Math.max(0, minM01HitCount);
        int new90Min = minNew90Count == null ? 0 : Math.max(0, minNew90Count);
        int goodMin = minGoodTendencyCount == null ? 0 : Math.max(0, minGoodTendencyCount);
        int strongMax = maxAttentionStrongCount == null ? Integer.MAX_VALUE : Math.max(0, maxAttentionStrongCount);
        boolean hasPostFilter = m01Min > 0 || new90Min > 0 || goodMin > 0 || strongMax != Integer.MAX_VALUE;
        int queryLimit = hasPostFilter ? Math.min(Math.max(finalLimit * 5, 1000), 5000) : finalLimit;
        List<ShopProfileSummary> list = summary(marketplace, batchDate, sellerNameKeyword, minProductCount, queryLimit, sourceRunId);
        return list.stream()
                .filter(s -> nvl(s.getM01HitCount()) >= m01Min)
                .filter(s -> nvl(s.getNew90Count()) >= new90Min)
                .filter(s -> nvl(s.getGoodTendencyCount()) >= goodMin)
                .filter(s -> nvl(s.getAttentionStrongCount()) <= strongMax)
                .limit(finalLimit)
                .collect(Collectors.toList());
    }

    // ========================================================================
    //  统一选品页适配（跨店 shop_products 卡片流）
    // ========================================================================

    /**
     * 店铺商品跨店分页。统一选品页与新品榜共用一套筛选外壳，仅在这里替换数据源。
     */
    public PageResult<ShopProduct> selectionProducts(ShopProductSelectionQuery query) {
        int page = Math.max(1, query.getPage() == null ? 1 : query.getPage());
        int size = Math.min(500, Math.max(1, query.getSize() == null ? 60 : query.getSize()));
        String marketplace = MarketplaceSupport.require(query.getMarketplace());
        String methodId = normalizeSelectionMethod(query.getMethodId());

        LambdaQueryWrapper<ShopProduct> qw = new LambdaQueryWrapper<ShopProduct>()
                .eq(ShopProduct::getMarketplace, marketplace)
                .in(hasItems(query.getAsins()), ShopProduct::getAsin, query.getAsins())
                .like(StringUtils.hasText(query.getTitle()), ShopProduct::getTitle, query.getTitle())
                .like(StringUtils.hasText(query.getSellerName()), ShopProduct::getSellerName, query.getSellerName())
                .like(StringUtils.hasText(query.getBrand()), ShopProduct::getBrand, query.getBrand())
                .in(hasItems(query.getBatchDates()), ShopProduct::getBatchDate, query.getBatchDates())
                .ge(query.getPriceMin() != null, ShopProduct::getPrice, query.getPriceMin())
                .le(query.getPriceMax() != null, ShopProduct::getPrice, query.getPriceMax())
                .ge(query.getUnitsMin() != null, ShopProduct::getUnits, query.getUnitsMin())
                .le(query.getUnitsMax() != null, ShopProduct::getUnits, query.getUnitsMax())
                .ge(query.getListingDaysMin() != null, ShopProduct::getListingDays, query.getListingDaysMin())
                .le(query.getListingDaysMax() != null, ShopProduct::getListingDays, query.getListingDaysMax())
                .le(query.getBsrMax() != null, ShopProduct::getBsr, query.getBsrMax())
                .le(query.getWeightMax() != null, ShopProduct::getWeightG, query.getWeightMax())
                .le(query.getMaxVariantCount() != null, ShopProduct::getVariations, query.getMaxVariantCount())
                .in(hasItems(query.getFulfillment()), ShopProduct::getFulfillment, query.getFulfillment())
                .in(hasItems(query.getGrade()), ShopProduct::getGrade, query.getGrade());

        applySelectionMethodRule(qw, methodId, marketplace);

        if (hasItems(query.getCategories())) {
            List<String> categories = query.getCategories().stream().filter(StringUtils::hasText).toList();
            if (!categories.isEmpty()) {
                qw.and(group -> {
                    group.like(ShopProduct::getNodeLabelPath, categories.get(0));
                    for (int i = 1; i < categories.size(); i++) {
                        group.or().like(ShopProduct::getNodeLabelPath, categories.get(i));
                    }
                });
            }
        }

        boolean asc = "asc".equalsIgnoreCase(query.getSortOrder());
        switch (query.getSortBy() == null ? "" : query.getSortBy()) {
            case "salesVolume" -> qw.orderBy(true, asc, ShopProduct::getUnits);
            case "price" -> qw.orderBy(true, asc, ShopProduct::getPrice);
            case "listingDate" -> qw.orderBy(true, asc, ShopProduct::getAvailableDate);
            case "bsr" -> qw.orderBy(true, asc, ShopProduct::getBsr);
            case "score" -> qw.orderBy(true, asc, ShopProduct::getScore);
            case "createdAt" -> qw.orderBy(true, asc, ShopProduct::getCreatedAt);
            default -> qw.orderByDesc(ShopProduct::getUpdatedAt);
        }

        Page<ShopProduct> result = shopProductMapper.selectPage(new Page<>(page, size), qw);
        return PageResult.of(result.getRecords(), result.getTotal(), (long) page, (long) size);
    }

    /** 统一选品页的店铺商品类目下拉。 */
    public List<Map<String, Object>> selectionCategories(String marketplace) {
        String mp = MarketplaceSupport.require(marketplace);
        QueryWrapper<ShopProduct> qw = new QueryWrapper<ShopProduct>()
                .select("node_label_path AS category", "COUNT(1) AS count")
                .eq("marketplace", mp)
                .isNotNull("node_label_path")
                .ne("node_label_path", "")
                .groupBy("node_label_path")
                .orderByDesc("count")
                .last("LIMIT 200");
        return shopProductMapper.selectMaps(qw);
    }

    /** 统一选品页的店铺抓取批次下拉；不默认过滤，用户选择后才按批次收窄。 */
    public List<Map<String, Object>> selectionBatches(String marketplace) {
        String mp = MarketplaceSupport.require(marketplace);
        QueryWrapper<ShopProduct> qw = new QueryWrapper<ShopProduct>()
                .select("batch_date AS batchDate", "COUNT(1) AS count")
                .eq("marketplace", mp)
                .isNotNull("batch_date")
                .ne("batch_date", "")
                .groupBy("batch_date")
                .orderByDesc("batch_date");
        return shopProductMapper.selectMaps(qw);
    }

    private static boolean hasItems(Collection<?> values) {
        return values != null && !values.isEmpty();
    }

    /**
     * 方法规则与数据源分离：规则只收窄当前的 shop_products 查询，绝不改为读取其他表。
     * 所有条件都在 SQL 分页前执行，避免将跨店全量商品拉到 JVM 内存后再筛选。
     */
    private static void applySelectionMethodRule(LambdaQueryWrapper<ShopProduct> qw,
                                                 String methodId,
                                                 String marketplace) {
        if (methodId == null) {
            return;
        }
        if ("M01".equals(methodId)) {
            applyM01SelectionRule(qw, M01Rule.forMarketplace(marketplace));
            return;
        }
        if ("M03".equals(methodId)) {
            applyM03SelectionRule(qw, M03Rule.forMarketplace(marketplace));
            return;
        }
        throw new IllegalArgumentException("店铺选品仅支持 M01 或 M03 方法卡");
    }

    private static void applyM01SelectionRule(LambdaQueryWrapper<ShopProduct> qw, M01Rule rule) {
        qw.ge(ShopProduct::getPrice, rule.priceMin())
                .le(ShopProduct::getPrice, rule.priceMax())
                .lt(ShopProduct::getWeightG, rule.weightMax())
                .lt(ShopProduct::getListingDays, rule.listingDaysMax());

        // 与 M01Rule.matches 的 30/60/90 天分档及 BSR 兜底保持逐项同口径。
        qw.and(group -> {
            group.and(days30 -> days30
                            .le(ShopProduct::getListingDays, 30)
                            .ge(ShopProduct::getUnits, rule.sales30()))
                    .or(days60 -> days60
                            .gt(ShopProduct::getListingDays, 30)
                            .le(ShopProduct::getListingDays, 60)
                            .ge(ShopProduct::getUnits, rule.sales60()))
                    .or(days90 -> days90
                            .gt(ShopProduct::getListingDays, 60)
                            .lt(ShopProduct::getListingDays, rule.listingDaysMax())
                            .ge(ShopProduct::getUnits, rule.sales90()));
            if (rule.bsrMax() != null) {
                group.or(bsr -> bsr
                        .gt(ShopProduct::getBsr, 0)
                        .lt(ShopProduct::getBsr, rule.bsrMax()));
            }
        });
    }

    private static void applyM03SelectionRule(LambdaQueryWrapper<ShopProduct> qw, M03Rule rule) {
        // M03Rule 对 fulfillment 的定义为大小写不敏感；数据库条件同步保持该语义。
        qw.apply("UPPER(fulfillment) = {0}", "FBM")
                .lt(ShopProduct::getListingDays, rule.listingDaysMax())
                .ge(ShopProduct::getUnits, rule.sales90());
    }

    private static String normalizeSelectionMethod(String methodId) {
        if (!StringUtils.hasText(methodId)) {
            return null;
        }
        String normalized = methodId.trim().toUpperCase(Locale.ROOT);
        if (!"M01".equals(normalized) && !"M03".equals(normalized)) {
            throw new IllegalArgumentException("店铺选品暂不支持 " + normalized + " 方法卡");
        }
        return normalized;
    }

    /** 单店全集商品明细分页（三维筛选：销量层 / 时间层 / 注意层 / M01 / 关键词 / 类目）。 */
    public PageResult<ShopProfileProduct> products(String marketplace, String sellerName, String batchDate,
                                                   String sourceRunId, String salesTier, String ageBucket,
                                                   String attentionLevel, Boolean m01Only, String keyword,
                                                   String category, Integer page, Integer size) {
        String mp = MarketplaceSupport.require(marketplace);
        String seller = requireText(sellerName, "sellerName 不能为空");
        String resolvedSourceRunId = null;
        if (StringUtils.hasText(sourceRunId)) {
            ShopSnapshot snapshot = resolveSnapshot(mp, seller, sourceRunId.trim(), null);
            batchDate = snapshot.batchDate();
            resolvedSourceRunId = snapshot.sourceRunId();
        }
        String bd = resolveBatchDate(mp, batchDate);
        String tier = normalizeSalesTier(salesTier);
        String age = normalizeAgeBucket(ageBucket);
        String level = normalizeAttentionLevel(attentionLevel);
        boolean m01 = Boolean.TRUE.equals(m01Only);
        int safePage = Math.max(1, page == null ? 1 : page);
        int safeSize = Math.max(1, Math.min(size == null ? 60 : size, 200));
        int offset = (safePage - 1) * safeSize;
        M01Rule rule = M01Rule.forMarketplace(mp);

        if (level != null) {
            return productsWithExactAttentionFilter(mp, seller, bd, resolvedSourceRunId, tier, age, level,
                    m01, keyword, category, safePage, safeSize, rule);
        }

        long total = shopProfileMapper.countProductsFromShopProducts(
                mp, seller, bd, resolvedSourceRunId, tier, age, m01, blankToNull(keyword), null, blankToNull(category),
                rule.priceMin(), rule.priceMax(), rule.weightMax(), rule.listingDaysMax(),
                rule.sales30(), rule.sales60(), rule.sales90(), rule.bsrMax());
        if (total == 0) {
            return PageResult.empty((long) safePage, (long) safeSize);
        }
        List<ShopProfileProduct> list = shopProfileMapper.selectProductsFromShopProducts(
                mp, seller, bd, resolvedSourceRunId, tier, age, m01, blankToNull(keyword), null, blankToNull(category),
                rule.priceMin(), rule.priceMax(), rule.weightMax(), rule.listingDaysMax(),
                rule.sales30(), rule.sales60(), rule.sales90(), rule.bsrMax(),
                offset, safeSize);
        list.forEach(this::attachProductLabel);
        return PageResult.of(list, total, (long) safePage, (long) safeSize);
    }

    /**
     * 注意/倾向层不是落库字段，必须逐商品按 categoryLeaf + nodeLabelPath 精确打标签。
     *
     * <p>这里先用 SQL 下推销量层/时间层/M01/关键词/类目，再在单店候选商品内做 Java 侧精确分页。
     * 单店全集通常是百级到千级商品；超过保护上限时要求缩窄筛选，避免一次性拉取异常大店。
     */
    private PageResult<ShopProfileProduct> productsWithExactAttentionFilter(
            String marketplace, String sellerName, String batchDate, String sourceRunId,
            String salesTier, String ageBucket, String attentionLevel, boolean m01Only,
            String keyword, String category, int page, int size, M01Rule rule) {
        long baseTotal = shopProfileMapper.countProductsFromShopProducts(
                marketplace, sellerName, batchDate, sourceRunId, salesTier, ageBucket, m01Only,
                blankToNull(keyword), null, blankToNull(category),
                rule.priceMin(), rule.priceMax(), rule.weightMax(), rule.listingDaysMax(),
                rule.sales30(), rule.sales60(), rule.sales90(), rule.bsrMax());
        if (baseTotal == 0) {
            return PageResult.empty((long) page, (long) size);
        }
        if (baseTotal > 20000) {
            throw new IllegalArgumentException("注意/倾向层筛选需要逐商品精确打标签，当前候选商品超过 20000，请先缩窄销量层、时间层、关键词或类目");
        }
        List<ShopProfileProduct> candidates = shopProfileMapper.selectProductsFromShopProducts(
                marketplace, sellerName, batchDate, sourceRunId, salesTier, ageBucket, m01Only,
                blankToNull(keyword), null, blankToNull(category),
                rule.priceMin(), rule.priceMax(), rule.weightMax(), rule.listingDaysMax(),
                rule.sales30(), rule.sales60(), rule.sales90(), rule.bsrMax(),
                0, (int) baseTotal);
        candidates.forEach(this::attachProductLabel);
        List<ShopProfileProduct> filtered = candidates.stream()
                .filter(p -> attentionLevel.equals(defaultAttention(p.getAttentionLevel())))
                .collect(Collectors.toList());
        return PageResult.of(paginateList(filtered, page, size), (long) filtered.size(), (long) page, (long) size);
    }

    /** 给商品行补注意/倾向标签，让前端能解释“为什么筛出来”。 */
    private void attachProductLabel(ShopProfileProduct product) {
        CategoryLabel label = labelRule.classify(product.getCategoryLeaf(), product.getNodeLabelPath());
        product.setAttentionLevel(label.level());
        product.setAttentionReason(label.reason());
        product.setLabelMeaning(label.meaning());
    }

    // ========================================================================
    //  三维聚合：注意层补齐 + 时间桶统计 + 三张矩阵 + 店铺类型
    // ========================================================================

    /** 给每个三维 cell 打上注意/倾向层（复用类目标签规则，口径唯一）。 */
    private void attachCellAttention(ShopTierAgeCategoryCell cell) {
        CategoryLabel label = labelRule.classify(cell.getCategoryKey(), cell.getNodeLabelPath());
        cell.setAttentionLevel(label.level());
    }

    /** 给列表摘要补三维字段，供“竞品店铺列表”直接筛选/排序/判断。 */
    private void enrichSummary3d(String marketplace, String batchDate, String sourceRunId, List<ShopProfileSummary> summaries) {
        if (summaries == null || summaries.isEmpty()) {
            return;
        }
        M01Rule rule = M01Rule.forMarketplace(marketplace);
        List<String> sellerNames = summaries.stream()
                .map(ShopProfileSummary::getSellerName)
                .filter(StringUtils::hasText)
                .distinct()
                .collect(Collectors.toList());
        if (sellerNames.isEmpty()) {
            return;
        }

        List<ShopTierAgeCategoryCell> allCells = shopProfileMapper.selectTierAgeCategoryCellsBatchFromShopProducts(
                marketplace, sellerNames, batchDate, sourceRunId,
                rule.priceMin(), rule.priceMax(), rule.weightMax(), rule.listingDaysMax(),
                rule.sales30(), rule.sales60(), rule.sales90(), rule.bsrMax());
        allCells.forEach(this::attachCellAttention);
        Map<String, List<ShopTierAgeCategoryCell>> cellsBySeller = allCells.stream()
                .filter(c -> StringUtils.hasText(c.getSellerName()))
                .collect(Collectors.groupingBy(ShopTierAgeCategoryCell::getSellerName));

        for (ShopProfileSummary summary : summaries) {
            if (!StringUtils.hasText(summary.getSellerName())) {
                continue;
            }
            List<ShopTierAgeCategoryCell> cells = cellsBySeller.getOrDefault(summary.getSellerName(), Collections.emptyList());
            applySummary3d(summary, cells);
        }
    }

    private void applySummary3d(ShopProfileSummary summary, List<ShopTierAgeCategoryCell> cells) {
        long total = nvl(summary.getProductCount());
        long newProduct = 0;
        long newAbc = 0;
        long oldD = 0;
        long good = 0;
        long strong = 0;
        long review = 0;
        for (ShopTierAgeCategoryCell c : cells) {
            String tier = defaultTier(c.getSalesTier());
            String age = defaultAge(c.getAgeBucket());
            String attention = defaultAttention(c.getAttentionLevel());
            long cnt = nvl(c.getProductCount());
            if ("NEW".equals(age)) {
                newProduct += cnt;
                if (isAbc(tier)) {
                    newAbc += cnt;
                }
            }
            if ("OLD".equals(age) && "D".equals(tier)) {
                oldD += cnt;
            }
            if ("GOOD_TENDENCY".equals(attention)) {
                good += cnt;
            } else if ("ATTENTION_STRONG".equals(attention)) {
                strong += cnt;
            } else if ("ATTENTION_REVIEW".equals(attention)) {
                review += cnt;
            }
        }
        summary.setNewProductCount(newProduct);
        summary.setNewABCCount(newAbc);
        summary.setNewABCRatio(ratio(newAbc, total));
        summary.setOldDCount(oldD);
        summary.setOldDRatio(ratio(oldD, total));
        summary.setGoodTendencyCount(good);
        summary.setAttentionStrongCount(strong);
        summary.setAttentionReviewCount(review);
        String type = resolveShopProfile3dType(summary, cells);
        summary.setShopProfile3dType(type);
        summary.setShopProfile3dExplanation(explainShopProfile3dType(type));
    }

    /** 互斥时间桶统计（模型分层，非累计窗口）。 */
    private List<ShopAgeBucketStat> buildAgeBucketStats(List<ShopTierAgeCategoryCell> cells) {
        Map<String, ShopAgeBucketStat> map = new LinkedHashMap<>();
        for (String age : AGE_ORDER) {
            ShopAgeBucketStat stat = new ShopAgeBucketStat();
            stat.setAgeBucket(age);
            stat.setProductCount(0L);
            stat.setUnitsSum(0L);
            stat.setM01HitCount(0L);
            stat.setAbcCount(0L);
            map.put(age, stat);
        }
        for (ShopTierAgeCategoryCell c : cells) {
            ShopAgeBucketStat stat = map.get(defaultAge(c.getAgeBucket()));
            if (stat == null) continue;
            long count = nvl(c.getProductCount());
            stat.setProductCount(stat.getProductCount() + count);
            stat.setUnitsSum(stat.getUnitsSum() + nvl(c.getUnitsSum()));
            stat.setM01HitCount(stat.getM01HitCount() + nvl(c.getM01HitCount()));
            if (isAbc(c.getSalesTier())) {
                stat.setAbcCount(stat.getAbcCount() + count);
            }
        }
        for (ShopAgeBucketStat stat : map.values()) {
            long count = stat.getProductCount();
            stat.setAvgUnits(count == 0 ? 0.0 : round2(stat.getUnitsSum() * 1.0 / count));
        }
        return map.values().stream().filter(s -> s.getProductCount() > 0).collect(Collectors.toList());
    }

    /** 从 cells 聚合出指定二维矩阵。cell 的注意层此时已由 Java 规则补齐。 */
    private ShopMatrix buildMatrix(List<ShopTierAgeCategoryCell> cells, String type) {
        List<String> rowKeys;
        List<String> colKeys;
        String rowDim;
        String colDim;
        switch (type) {
            case "SALES_AGE" -> { rowKeys = TIER_ORDER; colKeys = AGE_ORDER; rowDim = "销量层"; colDim = "时间层"; }
            case "SALES_ATTENTION" -> { rowKeys = TIER_ORDER; colKeys = ATTENTION_ORDER; rowDim = "销量层"; colDim = "注意/倾向层"; }
            case "AGE_ATTENTION" -> { rowKeys = AGE_ORDER; colKeys = ATTENTION_ORDER; rowDim = "时间层"; colDim = "注意/倾向层"; }
            default -> throw new IllegalArgumentException("unknown matrix type: " + type);
        }
        Map<String, ShopMatrixCell> agg = new LinkedHashMap<>();
        for (ShopTierAgeCategoryCell c : cells) {
            String row;
            String col;
            switch (type) {
                case "SALES_AGE" -> { row = defaultTier(c.getSalesTier()); col = defaultAge(c.getAgeBucket()); }
                case "SALES_ATTENTION" -> { row = defaultTier(c.getSalesTier()); col = defaultAttention(c.getAttentionLevel()); }
                default -> { row = defaultAge(c.getAgeBucket()); col = defaultAttention(c.getAttentionLevel()); }
            }
            String key = row + "" + col;
            ShopMatrixCell mc = agg.computeIfAbsent(key, ignored -> new ShopMatrixCell(row, col));
            mc.setProductCount(mc.getProductCount() + nvl(c.getProductCount()));
            mc.setUnitsSum(mc.getUnitsSum() + nvl(c.getUnitsSum()));
            mc.setM01HitCount(mc.getM01HitCount() + nvl(c.getM01HitCount()));
        }
        ShopMatrix matrix = new ShopMatrix();
        matrix.setName(type);
        matrix.setRowDim(rowDim);
        matrix.setColDim(colDim);
        matrix.setRowKeys(rowKeys);
        matrix.setColKeys(colKeys);
        matrix.setCells(agg.values().stream()
                .filter(c -> c.getProductCount() > 0)
                .collect(Collectors.toList()));
        return matrix;
    }

    /** 好品倾向 / 强注意+需复核 的 top 类目（按商品数）。 */
    private List<String> topCategoriesByAttention(List<ShopTierAgeCategoryCell> cells, boolean goodTendency) {
        Map<String, Long> counts = new HashMap<>();
        for (ShopTierAgeCategoryCell c : cells) {
            String level = defaultAttention(c.getAttentionLevel());
            boolean match = goodTendency
                    ? "GOOD_TENDENCY".equals(level)
                    : ("ATTENTION_STRONG".equals(level) || "ATTENTION_REVIEW".equals(level));
            if (match && StringUtils.hasText(c.getCategoryKey())) {
                counts.merge(c.getCategoryKey(), nvl(c.getProductCount()), Long::sum);
            }
        }
        return counts.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .limit(8)
                .map(Map.Entry::getKey)
                .collect(Collectors.toList());
    }

    /** 三维店铺类型（解释标签，非最终评级）。基于销量结构 + 新品/老品互斥桶 + 好品倾向/注意占比。 */
    private String resolveShopProfile3dType(ShopProfileSummary profile, List<ShopTierAgeCategoryCell> cells) {
        long total = nvl(profile.getProductCount());
        if (total < 10) return "小样本待观察型";

        long newAbc = 0, m01Hit = 0, oldD = 0, good = 0, attention = 0;
        long a = 0, b = 0, matureOldAb = 0;
        for (ShopTierAgeCategoryCell c : cells) {
            String tier = defaultTier(c.getSalesTier());
            String age = defaultAge(c.getAgeBucket());
            String level = defaultAttention(c.getAttentionLevel());
            long cnt = nvl(c.getProductCount());
            m01Hit += nvl(c.getM01HitCount());
            if ("A".equals(tier)) a += cnt;
            if ("B".equals(tier)) b += cnt;
            if ("NEW".equals(age) && isAbc(tier)) newAbc += cnt;
            if ("OLD".equals(age) && "D".equals(tier)) oldD += cnt;
            if (("MATURE".equals(age) || "OLD".equals(age)) && ("A".equals(tier) || "B".equals(tier))) matureOldAb += cnt;
            if ("GOOD_TENDENCY".equals(level)) good += cnt;
            if ("ATTENTION_STRONG".equals(level) || "ATTENTION_REVIEW".equals(level)) attention += cnt;
        }
        double newAbcRatio = ratio(newAbc, total);
        double oldDRatio = ratio(oldD, total);
        double goodRatio = ratio(good, total);
        double attentionRatio = ratio(attention, total);
        double abRatio = ratio(a + b, total);

        if (newAbcRatio >= 0.15 && attentionRatio >= 0.35) return "高注意高销量型";
        if (newAbcRatio >= 0.20 && m01Hit >= 5 && goodRatio >= 0.20) return "新品发动机型";
        if (abRatio >= 0.15 && oldDRatio >= 0.20 && newAbcRatio >= 0.10) return "健康精铺飞轮型";
        if (matureOldAb > 0 && abRatio >= 0.15 && newAbcRatio < 0.10) return "成熟利润型";
        if (oldDRatio >= 0.45) return "老品沉淀型";
        if (newAbcRatio >= 0.10) return "成长测品型";
        return "稳定候选池型";
    }

    private String explainShopProfile3dType(String type) {
        return switch (type == null ? "" : type) {
            case "新品发动机型" -> "新品 A/B/C 多、M01 命中多、好品倾向高，代表当前选品能力，最值得学。";
            case "健康精铺飞轮型" -> "老 A/B 有利润锚点、新 D 在测品、新 B/C 有成长，结构健康的飞轮。";
            case "成熟利润型" -> "A/B 偏成熟/老品，利润稳但新品能力一般，可学类目样貌而非最新机会。";
            case "成长测品型" -> "新 D 多并开始出现新 C/B，处于测品放量阶段，适合持续观察。";
            case "稳定候选池型" -> "B/C 成熟品厚、A 不多，稳定但缺爆发力。";
            case "高注意高销量型" -> "新品有市场信号但强注意/需复核占比高，涉及合规、责任、体积或履约，需人工判断。";
            case "老品沉淀型" -> "老 D 多、新品少，低价值沉淀，通常不是优先学习对象。";
            case "小样本待观察型" -> "商品数不足，暂不下结论，先补抓或观察。";
            default -> "解释标签，仅用于分析，不代表最终评级。";
        };
    }

    private boolean isAbc(String tier) {
        String t = defaultTier(tier);
        return "A".equals(t) || "B".equals(t) || "C".equals(t);
    }

    private String defaultAge(String age) {
        return StringUtils.hasText(age) ? age : "UNKNOWN";
    }

    private String defaultAttention(String level) {
        return StringUtils.hasText(level) ? level : "UNKNOWN";
    }

    private String normalizeAgeBucket(String ageBucket) {
        if (!StringUtils.hasText(ageBucket)) return null;
        String v = ageBucket.trim().toUpperCase(Locale.ROOT);
        return switch (v) {
            case "NEW", "GROWING", "MATURE", "OLD", "UNKNOWN" -> v;
            default -> throw new IllegalArgumentException("ageBucket 仅支持 NEW/GROWING/MATURE/OLD/UNKNOWN");
        };
    }

    private String normalizeAttentionLevel(String level) {
        if (!StringUtils.hasText(level)) return null;
        String v = level.trim().toUpperCase(Locale.ROOT);
        return switch (v) {
            case "ATTENTION_STRONG", "ATTENTION_REVIEW", "GOOD_TENDENCY", "NEUTRAL", "UNKNOWN" -> v;
            default -> throw new IllegalArgumentException("attentionLevel 仅支持 ATTENTION_STRONG/ATTENTION_REVIEW/GOOD_TENDENCY/NEUTRAL/UNKNOWN");
        };
    }

    // ========================================================================
    //  私有工具方法
    // ========================================================================

    private List<ShopProfileSummary> selectSummaryFromShopProducts(String marketplace, String batchDate, String sourceRunId,
                                                                   String sellerNameKeyword, Integer minProductCount, Integer limit) {
        M01Rule rule = M01Rule.forMarketplace(marketplace);
        return shopProfileMapper.selectSummaryFromShopProducts(
                marketplace, batchDate, sourceRunId, sellerNameKeyword, minProductCount, limit,
                rule.priceMin(), rule.priceMax(), rule.weightMax(), rule.listingDaysMax(),
                rule.sales30(), rule.sales60(), rule.sales90(), rule.bsrMax());
    }

    private void attachRisk(ShopCategoryInsight category) {
        CategoryLabel label = labelRule.classify(category.getCategoryKey(), category.getNodeLabelPath());
        category.setAttentionLevel(label.level());        category.setAttentionReason(label.reason());
        category.setLabelMeaning(label.meaning());
        category.setAttentionTags(label.attentionTags());
        category.setTendencyTags(label.tendencyTags());
        category.setRiskLevel(label.level());
        category.setRiskReason(label.reason());
    }

    private List<ShopCategoryRiskInsight> buildCategoryLabelStats(List<ShopCategoryInsight> categories) {
        Map<String, ShopCategoryRiskInsight> grouped = new LinkedHashMap<>();
        Map<String, Double> listingWeighted = new HashMap<>();

        for (ShopCategoryInsight c : categories) {
            String level = StringUtils.hasText(c.getAttentionLevel()) ? c.getAttentionLevel() : "UNKNOWN";
            String reason = StringUtils.hasText(c.getAttentionReason()) ? c.getAttentionReason() : "UNKNOWN";
            String key = level + "\u0001" + reason;
            ShopCategoryRiskInsight stat = grouped.computeIfAbsent(key, ignored -> {
                ShopCategoryRiskInsight created = new ShopCategoryRiskInsight();
                created.setAttentionLevel(level);
                created.setAttentionReason(reason);
                created.setLabelMeaning(c.getLabelMeaning());
                created.setAttentionTags(new ArrayList<>(c.getAttentionTags()));
                created.setTendencyTags(new ArrayList<>(c.getTendencyTags()));
                created.setRiskLevel(level);
                created.setRiskReason(reason);
                return created;
            });
            long count = nvl(c.getProductCount());
            stat.setProductCount(nvl(stat.getProductCount()) + count);
            stat.setUnitsSum(nvl(stat.getUnitsSum()) + nvl(c.getUnitsSum()));
            stat.setM01HitCount(nvl(stat.getM01HitCount()) + nvl(c.getM01HitCount()));
            stat.setCategoryCount(nvl(stat.getCategoryCount()) + 1);
            if (StringUtils.hasText(c.getCategoryKey())) {
                stat.getTopCategories().add(c.getCategoryKey());
            }
            stat.getAttentionTags().addAll(c.getAttentionTags());
            stat.getTendencyTags().addAll(c.getTendencyTags());
            if (c.getAvgListingDays() != null && count > 0) {
                listingWeighted.merge(key, c.getAvgListingDays() * count, Double::sum);
            }
        }

        for (Map.Entry<String, ShopCategoryRiskInsight> entry : grouped.entrySet()) {
            ShopCategoryRiskInsight stat = entry.getValue();
            long count = nvl(stat.getProductCount());
            stat.setUnitsAvg(count == 0 ? 0.0 : round2(nvl(stat.getUnitsSum()) * 1.0 / count));
            stat.setAvgListingDays(count == 0 ? 0.0 : round2(listingWeighted.getOrDefault(entry.getKey(), 0.0) / count));
            stat.setTopCategories(stat.getTopCategories().stream()
                    .distinct()
                    .limit(5)
                    .collect(Collectors.toList()));
            stat.setAttentionTags(stat.getAttentionTags().stream().distinct().collect(Collectors.toList()));
            stat.setTendencyTags(stat.getTendencyTags().stream().distinct().collect(Collectors.toList()));
        }

        List<ShopCategoryRiskInsight> result = new ArrayList<>(grouped.values());
        result.sort(Comparator
                .comparing((ShopCategoryRiskInsight r) -> attentionSortRank(r.getAttentionLevel()))
                .thenComparing(ShopCategoryRiskInsight::getProductCount, Comparator.nullsLast(Comparator.reverseOrder())));
        return result;
    }

    private int attentionSortRank(String attentionLevel) {
        return switch (attentionLevel == null ? "" : attentionLevel) {
            case "ATTENTION_STRONG" -> 1;
            case "ATTENTION_REVIEW" -> 2;
            case "GOOD_TENDENCY" -> 3;
            case "UNKNOWN" -> 4;
            default -> 5;
        };
    }

    private Double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private String resolveBatchDate(String marketplace, String batchDate) {
        if (StringUtils.hasText(batchDate)) {
            return batchDate.trim();
        }
        return shopProductMapper.selectMaxBatchDate(marketplace);
    }

    /** 补算 ab/abc/占比/结构标签，阈值与 ShopProfileServiceImpl.resolveProfileType 一致。 */
    private void completeSummary(ShopProfileSummary summary) {
        long productCount = nvl(summary.getProductCount());
        long a = nvl(summary.getACount());
        long b = nvl(summary.getBCount());
        long c = nvl(summary.getCCount());
        long d = nvl(summary.getDCount());
        long ab = a + b;
        long abc = a + b + c;
        summary.setAbCount(ab);
        summary.setAbcCount(abc);
        summary.setARatio(ratio(a, productCount));
        summary.setAbRatio(ratio(ab, productCount));
        summary.setAbcRatio(ratio(abc, productCount));
        summary.setDRatio(ratio(d, productCount));
        summary.setVariationMode("Y");
        summary.setProfileType(resolveProfileType(productCount, summary.getAbRatio(), summary.getAbcRatio(), summary.getDRatio()));
    }

    private String resolveProfileType(long productCount, Double abRatio, Double abcRatio, Double dRatio) {
        if (productCount < 10) return "样本较小待观察型";
        double ab = abRatio == null ? 0 : abRatio;
        double abc = abcRatio == null ? 0 : abcRatio;
        double d = dRatio == null ? 0 : dRatio;
        if (abc >= 0.45 && ab >= 0.12 && d >= 0.25) return "健康精铺飞轮型";
        if (abc >= 0.50 && ab >= 0.15) return "成熟精铺利润型";
        if (abc >= 0.35) return "稳定候选池型";
        if (d >= 0.50) return "成长测品型";
        return "待观察型";
    }

    private Double ratio(long numerator, long denominator) {
        if (denominator <= 0) return 0.0;
        return Math.round((numerator * 1.0 / denominator) * 10000.0) / 10000.0;
    }

    private long nvl(Long value) {
        return value == null ? 0L : value;
    }

    private String requireText(String value, String message) {
        if (!StringUtils.hasText(value)) {
            throw new IllegalArgumentException(message);
        }
        return value.trim();
    }

    private String blankToNull(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private String normalizeSalesTier(String salesTier) {
        if (!StringUtils.hasText(salesTier)) return null;
        String tier = salesTier.trim().toUpperCase(Locale.ROOT);
        return switch (tier) {
            case "A", "B", "C", "D", "UNKNOWN" -> tier;
            default -> throw new IllegalArgumentException("salesTier 仅支持 A/B/C/D/UNKNOWN");
        };
    }
}
