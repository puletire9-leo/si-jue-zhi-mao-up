package com.sjzm.product.modules.shopcollection.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sjzm.common.PageResult;
import com.sjzm.product.modules.analysisbaseline.common.MarketplaceSupport;
import com.sjzm.product.modules.analysisbaseline.shopprofile.dto.ShopProfileProduct;
import com.sjzm.product.modules.analysisbaseline.shopprofile.dto.ShopProfileSummary;
import com.sjzm.product.modules.analysisbaseline.shopprofile.mapper.ShopProfileMapper;
import com.sjzm.product.modules.shopcandidate.entity.ShopFetchRun;
import com.sjzm.product.modules.shopcandidate.mapper.ShopFetchRunMapper;
import com.sjzm.product.modules.shopcollection.dto.ShopCollectionDetail;
import com.sjzm.product.modules.shopcollection.dto.ShopSnapshot;
import com.sjzm.product.modules.shopcollection.entity.ShopProduct;
import com.sjzm.product.modules.shopcollection.entity.ShopWatchlist;
import com.sjzm.product.modules.shopcollection.mapper.ShopProductMapper;
import com.sjzm.product.modules.shopcollection.mapper.ShopWatchlistMapper;
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

    private static final Set<String> SUCCESS_STATUSES = Set.of("SUCCESS", "PARTIAL_SUCCESS");

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

        List<ShopProfileSummary> summaries = shopProfileMapper.selectSummaryFromShopProducts(mp, bd, resolvedSourceRunId, seller, null, 50);
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
        List<ShopProfileSummary> list = shopProfileMapper.selectSummaryFromShopProducts(
                mp, bd, resolvedSourceRunId, blankToNull(sellerNameKeyword), minProductCount, lim);
        list.forEach(this::completeSummary);
        return list;
    }

    /** 单店全集商品明细分页。 */
    public PageResult<ShopProfileProduct> products(String marketplace, String sellerName, String batchDate,
                                                   String sourceRunId, String salesTier, String category, Integer page, Integer size) {
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
        int safePage = Math.max(1, page == null ? 1 : page);
        int safeSize = Math.max(1, Math.min(size == null ? 60 : size, 200));
        int offset = (safePage - 1) * safeSize;

        long total = shopProfileMapper.countProductsFromShopProducts(mp, seller, bd, resolvedSourceRunId, tier, blankToNull(category));
        if (total == 0) {
            return PageResult.empty((long) safePage, (long) safeSize);
        }
        List<ShopProfileProduct> list = shopProfileMapper.selectProductsFromShopProducts(
                mp, seller, bd, resolvedSourceRunId, tier, blankToNull(category), offset, safeSize);
        return PageResult.of(list, total, (long) safePage, (long) safeSize);
    }

    // ========================================================================
    //  私有工具方法
    // ========================================================================

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
