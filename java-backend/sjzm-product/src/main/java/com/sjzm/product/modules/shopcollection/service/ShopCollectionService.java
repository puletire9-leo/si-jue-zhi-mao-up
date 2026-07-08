package com.sjzm.product.modules.shopcollection.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sjzm.common.PageResult;
import com.sjzm.product.modules.analysisbaseline.common.MarketplaceSupport;
import com.sjzm.product.modules.analysisbaseline.shopprofile.dto.ShopProfileProduct;
import com.sjzm.product.modules.analysisbaseline.shopprofile.dto.ShopProfileSummary;
import com.sjzm.product.modules.analysisbaseline.shopprofile.mapper.ShopProfileMapper;
import com.sjzm.product.modules.shopcollection.dto.ShopCollectionDetail;
import com.sjzm.product.modules.shopcollection.entity.ShopWatchlist;
import com.sjzm.product.modules.shopcollection.mapper.ShopProductMapper;
import com.sjzm.product.modules.shopcollection.mapper.ShopWatchlistMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Locale;

/**
 * 店铺全集读侧聚合：单店全景详情 + 全集商品分页。
 * 读的是 shop_products（观察池抓来的店铺全集），复用店铺画像的父体去重/tier/类目 SQL。
 */
@Service
@RequiredArgsConstructor
public class ShopCollectionService {

    private final ShopProfileMapper shopProfileMapper;
    private final ShopProductMapper shopProductMapper;
    private final ShopWatchlistMapper watchlistMapper;

    /** 单店全景：观察池进入原因 + 全集 A/B/C/D 画像 + 类目结构。 */
    public ShopCollectionDetail detail(String marketplace, String sellerName, String batchDate) {
        String mp = MarketplaceSupport.require(marketplace);
        String seller = requireText(sellerName, "sellerName 不能为空");
        String bd = resolveBatchDate(mp, batchDate);

        ShopCollectionDetail detail = new ShopCollectionDetail();

        LambdaQueryWrapper<ShopWatchlist> wlQw = new LambdaQueryWrapper<ShopWatchlist>()
                .eq(ShopWatchlist::getMarketplace, mp)
                .eq(ShopWatchlist::getSellerName, seller)
                .orderByDesc(ShopWatchlist::getUpdatedAt);
        detail.setWatchlistEntries(watchlistMapper.selectList(wlQw));

        List<ShopProfileSummary> summaries = shopProfileMapper.selectSummaryFromShopProducts(mp, bd, seller, null, 50);
        ShopProfileSummary profile = summaries.stream()
                .filter(s -> seller.equals(s.getSellerName()))
                .findFirst()
                .orElse(null);
        if (profile != null) {
            completeSummary(profile);
        }
        detail.setProfile(profile);
        detail.setCategories(shopProfileMapper.selectCategoriesFromShopProducts(mp, seller, bd, null));
        return detail;
    }

    /** 店铺全集列表（按店铺聚合画像）。 */
    public List<ShopProfileSummary> summary(String marketplace, String batchDate, String sellerNameKeyword,
                                            Integer minProductCount, Integer limit) {
        String mp = MarketplaceSupport.require(marketplace);
        String bd = resolveBatchDate(mp, batchDate);
        int lim = limit == null || limit < 1 ? 100 : Math.min(limit, 1000);
        List<ShopProfileSummary> list = shopProfileMapper.selectSummaryFromShopProducts(
                mp, bd, blankToNull(sellerNameKeyword), minProductCount, lim);
        list.forEach(this::completeSummary);
        return list;
    }

    /** 单店全集商品明细分页。 */
    public PageResult<ShopProfileProduct> products(String marketplace, String sellerName, String batchDate,
                                                   String salesTier, String category, Integer page, Integer size) {
        String mp = MarketplaceSupport.require(marketplace);
        String seller = requireText(sellerName, "sellerName 不能为空");
        String bd = resolveBatchDate(mp, batchDate);
        String tier = normalizeSalesTier(salesTier);
        int safePage = Math.max(1, page == null ? 1 : page);
        int safeSize = Math.max(1, Math.min(size == null ? 60 : size, 200));
        int offset = (safePage - 1) * safeSize;

        long total = shopProfileMapper.countProductsFromShopProducts(mp, seller, bd, tier, blankToNull(category));
        if (total == 0) {
            return PageResult.empty((long) safePage, (long) safeSize);
        }
        List<ShopProfileProduct> list = shopProfileMapper.selectProductsFromShopProducts(
                mp, seller, bd, tier, blankToNull(category), offset, safeSize);
        return PageResult.of(list, total, (long) safePage, (long) safeSize);
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
