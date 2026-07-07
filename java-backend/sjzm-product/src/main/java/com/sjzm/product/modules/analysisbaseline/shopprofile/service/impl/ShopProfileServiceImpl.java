package com.sjzm.product.modules.analysisbaseline.shopprofile.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sjzm.common.PageResult;
import com.sjzm.product.modules.analysisbaseline.common.MarketplaceSupport;
import com.sjzm.product.modules.analysisbaseline.shopprofile.dto.ShopProfileCategory;
import com.sjzm.product.modules.analysisbaseline.shopprofile.dto.ShopProfileComputeResult;
import com.sjzm.product.modules.analysisbaseline.shopprofile.dto.ShopProfileDetail;
import com.sjzm.product.modules.analysisbaseline.shopprofile.dto.ShopProfilePositioningComputeResult;
import com.sjzm.product.modules.analysisbaseline.shopprofile.dto.ShopProfilePositioningResult;
import com.sjzm.product.modules.analysisbaseline.shopprofile.dto.ShopProfileProduct;
import com.sjzm.product.modules.analysisbaseline.shopprofile.dto.ShopProfileSummary;
import com.sjzm.product.modules.analysisbaseline.shopprofile.entity.ShopProfileBaseline;
import com.sjzm.product.modules.analysisbaseline.shopprofile.entity.ShopProfileBaselineMember;
import com.sjzm.product.modules.analysisbaseline.shopprofile.entity.ShopProfilePositioningResultEntity;
import com.sjzm.product.modules.analysisbaseline.shopprofile.entity.ShopProfileSnapshot;
import com.sjzm.product.modules.analysisbaseline.shopprofile.mapper.ShopProfileBaselineMapper;
import com.sjzm.product.modules.analysisbaseline.shopprofile.mapper.ShopProfileBaselineMemberMapper;
import com.sjzm.product.modules.analysisbaseline.shopprofile.mapper.ShopProfileMapper;
import com.sjzm.product.modules.analysisbaseline.shopprofile.mapper.ShopProfilePositioningResultMapper;
import com.sjzm.product.modules.analysisbaseline.shopprofile.mapper.ShopProfileSnapshotMapper;
import com.sjzm.product.modules.analysisbaseline.shopprofile.service.ShopProfileService;
import com.sjzm.product.service.DengZongShopService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ShopProfileServiceImpl implements ShopProfileService {

    private static final String VARIATION_MODE_NO_VARIANTS = "Y";

    private final ShopProfileMapper mapper;
    private final ShopProfileSnapshotMapper snapshotMapper;
    private final ShopProfileBaselineMapper baselineMapper;
    private final ShopProfileBaselineMemberMapper baselineMemberMapper;
    private final ShopProfilePositioningResultMapper positioningResultMapper;
    private final DengZongShopService dengZongShopService;

    @Override
    public List<ShopProfileSummary> summary(String marketplace, String batchDate, String sellerNameKeyword,
                                            Integer minProductCount, Integer limit) {
        String mp = requireMarketplace(marketplace);
        String bd = resolveBatchDate(mp, batchDate);
        int lim = limit == null || limit < 1 ? 100 : Math.min(limit, 1000);
        List<ShopProfileSummary> list = mapper.selectSummary(
                mp,
                bd,
                blankToNull(sellerNameKeyword),
                minProductCount,
                lim
        );
        list.forEach(this::completeSummary);
        return list;
    }

    @Override
    public ShopProfileDetail detail(String marketplace, String sellerName, String batchDate) {
        String mp = requireMarketplace(marketplace);
        String seller = requireText(sellerName, "sellerName 不能为空");
        String bd = resolveBatchDate(mp, batchDate);
        List<ShopProfileSummary> summaries = mapper.selectSummary(mp, bd, seller, 1, 1000);
        ShopProfileSummary summary = summaries.stream()
                .filter(s -> seller.equals(s.getSellerName()))
                .findFirst()
                .orElseGet(() -> {
                    ShopProfileSummary empty = new ShopProfileSummary();
                    empty.setMarketplace(mp);
                    empty.setSellerName(seller);
                    empty.setProductCount(0L);
                    empty.setACount(0L);
                    empty.setBCount(0L);
                    empty.setCCount(0L);
                    empty.setDCount(0L);
                    empty.setUnknownCount(0L);
                    empty.setAbCount(0L);
                    empty.setAbcCount(0L);
                    empty.setLatestBatchDate(bd);
                    return empty;
                });
        completeSummary(summary);

        ShopProfileDetail detail = new ShopProfileDetail();
        detail.setSummary(summary);
        detail.setCategories(categories(mp, seller, bd, null));
        return detail;
    }

    @Override
    public PageResult<ShopProfileProduct> products(String marketplace, String sellerName, String batchDate,
                                                   String salesTier, String category, Integer page, Integer size) {
        String mp = requireMarketplace(marketplace);
        String seller = requireText(sellerName, "sellerName 不能为空");
        String bd = resolveBatchDate(mp, batchDate);
        String tier = normalizeSalesTier(salesTier);
        int safePage = Math.max(1, page == null ? 1 : page);
        int safeSize = Math.max(1, Math.min(size == null ? 60 : size, 200));
        int offset = (safePage - 1) * safeSize;

        long total = mapper.countProducts(mp, seller, bd, tier, blankToNull(category));
        if (total == 0) {
            return PageResult.empty((long) safePage, (long) safeSize);
        }
        List<ShopProfileProduct> list = mapper.selectProducts(
                mp, seller, bd, tier, blankToNull(category), offset, safeSize);
        return PageResult.of(list, total, (long) safePage, (long) safeSize);
    }

    @Override
    public List<ShopProfileCategory> categories(String marketplace, String sellerName, String batchDate, String salesTier) {
        String mp = requireMarketplace(marketplace);
        String seller = requireText(sellerName, "sellerName 不能为空");
        String bd = resolveBatchDate(mp, batchDate);
        return mapper.selectCategories(mp, seller, bd, normalizeSalesTier(salesTier));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ShopProfileComputeResult compute(String marketplace, String batchDate) {
        String mp = requireMarketplace(marketplace);
        String bd = resolveBatchDate(mp, batchDate);
        if (!StringUtils.hasText(bd)) {
            throw new IllegalArgumentException("batchDate 不能为空，且当前库没有可自动解析的最新批次");
        }

        int deletedSnapshots = mapper.deleteSnapshots(mp, bd);
        int deletedCategories = mapper.deleteCategories(mp, bd);
        int insertedSnapshots = mapper.insertSnapshotsFromDengZong(mp, bd);
        int insertedCategories = mapper.insertCategoriesFromDengZong(mp, bd);

        ShopProfileComputeResult result = new ShopProfileComputeResult();
        result.setMarketplace(mp);
        result.setBatchDate(bd);
        result.setVariationMode(VARIATION_MODE_NO_VARIANTS);
        result.setDeletedSnapshots(deletedSnapshots);
        result.setDeletedCategories(deletedCategories);
        result.setInsertedSnapshots(insertedSnapshots);
        result.setInsertedCategories(insertedCategories);
        result.setRequiresSqlMigration(true);
        result.setSourceTable("deng_zong_shop");
        return result;
    }

    @Override
    public List<ShopProfileSummary> snapshotSummary(String marketplace, String batchDate, String sellerNameKeyword,
                                                    Integer minProductCount, Integer limit) {
        String mp = requireMarketplace(marketplace);
        String bd = resolveSnapshotBatchDate(mp, batchDate);
        int lim = limit == null || limit < 1 ? 100 : Math.min(limit, 1000);

        LambdaQueryWrapper<ShopProfileSnapshot> wrapper = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(mp)) {
            wrapper.eq(ShopProfileSnapshot::getMarketplace, mp);
        }
        if (StringUtils.hasText(bd)) {
            wrapper.eq(ShopProfileSnapshot::getBatchDate, bd);
        }
        if (StringUtils.hasText(sellerNameKeyword)) {
            wrapper.like(ShopProfileSnapshot::getSellerName, sellerNameKeyword.trim());
        }
        if (minProductCount != null) {
            wrapper.ge(ShopProfileSnapshot::getProductCount, minProductCount);
        }
        wrapper.eq(ShopProfileSnapshot::getVariationMode, VARIATION_MODE_NO_VARIANTS)
                .orderByDesc(ShopProfileSnapshot::getProductCount)
                .orderByDesc(ShopProfileSnapshot::getAbcCount)
                .orderByAsc(ShopProfileSnapshot::getSellerName)
                .last("LIMIT " + lim);
        return snapshotMapper.selectList(wrapper).stream()
                .map(this::toSummary)
                .toList();
    }

    @Override
    public List<ShopProfilePositioningResult> positioning(String baselineCode, String marketplace, String batchDate,
                                                          String sellerNameKeyword, Integer limit) {
        String code = normalizeCode(baselineCode, "baselineCode 不能为空");
        String mp = requireMarketplace(marketplace);
        String bd = resolveSnapshotBatchDate(mp, batchDate);
        int lim = limit == null || limit < 1 ? 100 : Math.min(limit, 5000);
        return buildPositioningResults(code, mp, bd, blankToNull(sellerNameKeyword)).stream()
                .sorted(Comparator.comparing(ShopProfilePositioningResult::getSimilarityScore,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(lim)
                .toList();
    }

    @Override
    public ShopProfilePositioningResult positioningDetail(String marketplace, String sellerName,
                                                          String baselineCode, String batchDate) {
        String mp = requireMarketplace(marketplace);
        String seller = requireText(sellerName, "sellerName 不能为空");
        String code = normalizeCode(baselineCode, "baselineCode 不能为空");
        String bd = resolveSnapshotBatchDate(mp, batchDate);

        ShopProfileBaseline baseline = loadBaseline(code);

        LambdaQueryWrapper<ShopProfileSnapshot> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(ShopProfileSnapshot::getMarketplace, mp)
                .eq(ShopProfileSnapshot::getSellerName, seller)
                .eq(ShopProfileSnapshot::getBatchDate, bd)
                .eq(ShopProfileSnapshot::getVariationMode, VARIATION_MODE_NO_VARIANTS);
        ShopProfileSnapshot snapshot = snapshotMapper.selectOne(wrapper);
        if (snapshot == null) {
            throw new IllegalArgumentException("未找到该店铺的画像快照，请先执行 POST /api/v1/shop-profile/compute");
        }

        List<ShopProfileSnapshot> baselineSnapshots = loadBaselineSnapshots(code, mp, bd);
        if (baselineSnapshots.isEmpty()) {
            throw new IllegalArgumentException("基线没有可用成员快照，请先执行店铺画像 compute 并确认基线成员已录入");
        }
        BaselineMetrics metrics = BaselineMetrics.from(baselineSnapshots);
        return toPositioningResult(snapshot, baseline, metrics);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ShopProfilePositioningComputeResult computePositioning(String baselineCode, String marketplace, String batchDate) {
        String code = normalizeCode(baselineCode, "baselineCode 不能为空");
        String mp = requireMarketplace(marketplace);
        String bd = resolveSnapshotBatchDate(mp, batchDate);
        List<ShopProfilePositioningResult> results = buildPositioningResults(code, mp, bd, null);

        LambdaQueryWrapper<ShopProfilePositioningResultEntity> deleteWrapper = new LambdaQueryWrapper<>();
        deleteWrapper.eq(ShopProfilePositioningResultEntity::getBaselineCode, code)
                .eq(ShopProfilePositioningResultEntity::getBatchDate, bd)
                .eq(ShopProfilePositioningResultEntity::getVariationMode, VARIATION_MODE_NO_VARIANTS);
        if (StringUtils.hasText(mp)) {
            deleteWrapper.eq(ShopProfilePositioningResultEntity::getMarketplace, mp);
        }
        int deleted = positioningResultMapper.delete(deleteWrapper);

        int inserted = 0;
        for (ShopProfilePositioningResult result : results) {
            positioningResultMapper.insert(toPositioningEntity(result));
            inserted++;
        }

        ShopProfilePositioningComputeResult computeResult = new ShopProfilePositioningComputeResult();
        computeResult.setBaselineCode(code);
        computeResult.setMarketplace(mp);
        computeResult.setBatchDate(bd);
        computeResult.setVariationMode(VARIATION_MODE_NO_VARIANTS);
        computeResult.setDeletedResults(deleted);
        computeResult.setInsertedResults(inserted);
        computeResult.setRequiresSqlMigration(true);
        computeResult.setResultTable("shop_profile_positioning_result");
        return computeResult;
    }

    private List<ShopProfilePositioningResult> buildPositioningResults(String baselineCode, String marketplace,
                                                                       String batchDate, String sellerNameKeyword) {
        ShopProfileBaseline baseline = loadBaseline(baselineCode);
        List<ShopProfileSnapshot> snapshots = loadSnapshots(marketplace, batchDate, sellerNameKeyword);
        if (snapshots.isEmpty()) {
            return List.of();
        }

        List<ShopProfileSnapshot> baselineSnapshots = loadBaselineSnapshots(baselineCode, marketplace, batchDate);
        if (baselineSnapshots.isEmpty()) {
            throw new IllegalArgumentException("基线没有可用成员快照，请先执行店铺画像 compute 并确认基线成员已录入");
        }

        BaselineMetrics metrics = BaselineMetrics.from(baselineSnapshots);
        return snapshots.stream()
                .map(snapshot -> toPositioningResult(snapshot, baseline, metrics))
                .toList();
    }

    private ShopProfileBaseline loadBaseline(String baselineCode) {
        LambdaQueryWrapper<ShopProfileBaseline> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(ShopProfileBaseline::getBaselineCode, baselineCode);
        ShopProfileBaseline baseline = baselineMapper.selectOne(wrapper);
        if (baseline == null) {
            throw new IllegalArgumentException("基线不存在: " + baselineCode);
        }
        return baseline;
    }

    private List<ShopProfileSnapshot> loadSnapshots(String marketplace, String batchDate, String sellerNameKeyword) {
        LambdaQueryWrapper<ShopProfileSnapshot> wrapper = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(marketplace)) {
            wrapper.eq(ShopProfileSnapshot::getMarketplace, marketplace);
        }
        wrapper.eq(ShopProfileSnapshot::getBatchDate, batchDate)
                .eq(ShopProfileSnapshot::getVariationMode, VARIATION_MODE_NO_VARIANTS);
        if (StringUtils.hasText(sellerNameKeyword)) {
            wrapper.like(ShopProfileSnapshot::getSellerName, sellerNameKeyword.trim());
        }
        return snapshotMapper.selectList(wrapper);
    }

    private List<ShopProfileSnapshot> loadBaselineSnapshots(String baselineCode, String marketplace, String batchDate) {
        LambdaQueryWrapper<ShopProfileBaselineMember> memberWrapper = new LambdaQueryWrapper<>();
        memberWrapper.eq(ShopProfileBaselineMember::getBaselineCode, baselineCode)
                .eq(ShopProfileBaselineMember::getStatus, "ACTIVE");
        if (StringUtils.hasText(marketplace)) {
            memberWrapper.eq(ShopProfileBaselineMember::getMarketplace, marketplace);
        }
        Set<String> memberKeys = baselineMemberMapper.selectList(memberWrapper).stream()
                .map(member -> shopKey(member.getMarketplace(), member.getSellerName()))
                .collect(Collectors.toSet());
        if (memberKeys.isEmpty()) {
            return List.of();
        }
        return loadSnapshots(marketplace, batchDate, null).stream()
                .filter(snapshot -> memberKeys.contains(shopKey(snapshot.getMarketplace(), snapshot.getSellerName())))
                .toList();
    }

    private ShopProfilePositioningResult toPositioningResult(ShopProfileSnapshot snapshot,
                                                             ShopProfileBaseline baseline,
                                                             BaselineMetrics metrics) {
        ShopProfilePositioningResult result = new ShopProfilePositioningResult();
        result.setBaselineCode(baseline.getBaselineCode());
        result.setBaselineName(baseline.getBaselineName());
        result.setMarketplace(snapshot.getMarketplace());
        result.setSellerName(snapshot.getSellerName());
        result.setSellerId(snapshot.getSellerId());
        result.setBatchDate(snapshot.getBatchDate());
        result.setVariationMode(snapshot.getVariationMode());
        result.setProductCount(nvlInt(snapshot.getProductCount()));
        result.setACount(nvlInt(snapshot.getACount()));
        result.setBCount(nvlInt(snapshot.getBCount()));
        result.setCCount(nvlInt(snapshot.getCCount()));
        result.setDCount(nvlInt(snapshot.getDCount()));
        result.setUnknownCount(nvlInt(snapshot.getUnknownCount()));
        result.setAbCount(nvlInt(snapshot.getAbCount()));
        result.setAbcCount(nvlInt(snapshot.getAbcCount()));
        result.setARatio(decimalToDouble(snapshot.getARatio()));
        result.setAbRatio(decimalToDouble(snapshot.getAbRatio()));
        result.setAbcRatio(decimalToDouble(snapshot.getAbcRatio()));
        result.setDRatio(decimalToDouble(snapshot.getDRatio()));
        result.setTopACategory(snapshot.getTopACategory());
        result.setTopABCCategory(snapshot.getTopABCCategory());
        result.setTopDCategory(snapshot.getTopDCategory());
        result.setProfileType(snapshot.getProfileType());
        result.setBaselineShopCount(metrics.shopCount);
        result.setBaselineAvgProductCount(round(metrics.avgProductCount));
        result.setBaselineAvgARatio(round(metrics.avgARatio));
        result.setBaselineAvgAbRatio(round(metrics.avgAbRatio));
        result.setBaselineAvgAbcRatio(round(metrics.avgAbcRatio));
        result.setBaselineAvgDRatio(round(metrics.avgDRatio));

        double categoryScore = categoryMatchScore(snapshot, metrics);
        double score = similarityScore(snapshot, metrics, categoryScore);
        result.setCategoryMatchScore(round(categoryScore));
        result.setSimilarityScore(round(score));
        result.setPositioningLabel(positioningLabel(score));
        result.setProfileAdvice(profileAdvice(result, metrics));
        return result;
    }

    private double categoryMatchScore(ShopProfileSnapshot snapshot, BaselineMetrics metrics) {
        double score = 0;
        if (StringUtils.hasText(snapshot.getTopABCCategory()) && metrics.topAbcCategories.contains(snapshot.getTopABCCategory())) {
            score += 60;
        }
        if (StringUtils.hasText(snapshot.getTopACategory()) && metrics.topACategories.contains(snapshot.getTopACategory())) {
            score += 25;
        }
        if (StringUtils.hasText(snapshot.getTopDCategory()) && metrics.topDCategories.contains(snapshot.getTopDCategory())) {
            score += 15;
        }
        return score;
    }

    private double similarityScore(ShopProfileSnapshot snapshot, BaselineMetrics metrics, double categoryScore) {
        double productDistance = metrics.avgProductCount <= 0 ? 0 :
                Math.min(Math.abs(nvlInt(snapshot.getProductCount()) - metrics.avgProductCount) / metrics.avgProductCount, 1);
        double penalty =
                Math.abs(decimalToDouble(snapshot.getARatio()) - metrics.avgARatio) * 80 +
                Math.abs(decimalToDouble(snapshot.getAbRatio()) - metrics.avgAbRatio) * 80 +
                Math.abs(decimalToDouble(snapshot.getAbcRatio()) - metrics.avgAbcRatio) * 120 +
                Math.abs(decimalToDouble(snapshot.getDRatio()) - metrics.avgDRatio) * 80 +
                productDistance * 15;
        return Math.max(0, Math.min(100, 100 - penalty + categoryScore * 0.1));
    }

    private String positioningLabel(double score) {
        if (score >= 85) return "高度相似";
        if (score >= 70) return "接近基线";
        if (score >= 55) return "部分相似";
        return "差异明显";
    }

    private String profileAdvice(ShopProfilePositioningResult result, BaselineMetrics metrics) {
        if ("高度相似".equals(result.getPositioningLabel())) {
            return "店铺结构与基线高度接近，适合进入相似店铺重点观察池。";
        }
        if ("接近基线".equals(result.getPositioningLabel())) {
            return "店铺结构接近基线，可结合 ABC 类目和商品族命中继续判断。";
        }
        if (result.getDRatio() != null && result.getDRatio() > metrics.avgDRatio + 0.15) {
            return "D 层占比明显更高，更像测品阶段店铺，需要看后续留存和 ABC 转化。";
        }
        if (result.getAbcRatio() != null && result.getAbcRatio() < metrics.avgAbcRatio - 0.15) {
            return "ABC 稳定盘弱于基线，暂不宜只按店铺相似来放大跟进。";
        }
        return "与基线存在差异，建议结合方法卡命中、类目重合和商品族验证再判断。";
    }

    private ShopProfilePositioningResultEntity toPositioningEntity(ShopProfilePositioningResult result) {
        ShopProfilePositioningResultEntity entity = new ShopProfilePositioningResultEntity();
        entity.setBaselineCode(result.getBaselineCode());
        entity.setBaselineName(result.getBaselineName());
        entity.setMarketplace(result.getMarketplace());
        entity.setSellerName(result.getSellerName());
        entity.setSellerId(result.getSellerId());
        entity.setBatchDate(result.getBatchDate());
        entity.setVariationMode(result.getVariationMode());
        entity.setProductCount(result.getProductCount());
        entity.setACount(result.getACount());
        entity.setBCount(result.getBCount());
        entity.setCCount(result.getCCount());
        entity.setDCount(result.getDCount());
        entity.setUnknownCount(result.getUnknownCount());
        entity.setAbCount(result.getAbCount());
        entity.setAbcCount(result.getAbcCount());
        entity.setARatio(doubleToDecimal(result.getARatio()));
        entity.setAbRatio(doubleToDecimal(result.getAbRatio()));
        entity.setAbcRatio(doubleToDecimal(result.getAbcRatio()));
        entity.setDRatio(doubleToDecimal(result.getDRatio()));
        entity.setTopACategory(result.getTopACategory());
        entity.setTopABCCategory(result.getTopABCCategory());
        entity.setTopDCategory(result.getTopDCategory());
        entity.setProfileType(result.getProfileType());
        entity.setBaselineShopCount(result.getBaselineShopCount());
        entity.setBaselineAvgProductCount(doubleToDecimal(result.getBaselineAvgProductCount()));
        entity.setBaselineAvgARatio(doubleToDecimal(result.getBaselineAvgARatio()));
        entity.setBaselineAvgAbRatio(doubleToDecimal(result.getBaselineAvgAbRatio()));
        entity.setBaselineAvgAbcRatio(doubleToDecimal(result.getBaselineAvgAbcRatio()));
        entity.setBaselineAvgDRatio(doubleToDecimal(result.getBaselineAvgDRatio()));
        entity.setCategoryMatchScore(doubleToDecimal(result.getCategoryMatchScore()));
        entity.setSimilarityScore(doubleToDecimal(result.getSimilarityScore()));
        entity.setPositioningLabel(result.getPositioningLabel());
        entity.setProfileAdvice(result.getProfileAdvice());
        entity.setComputedAt(LocalDateTime.now());
        return entity;
    }

    private ShopProfileSummary toSummary(ShopProfileSnapshot snapshot) {
        ShopProfileSummary summary = new ShopProfileSummary();
        summary.setMarketplace(snapshot.getMarketplace());
        summary.setSellerName(snapshot.getSellerName());
        summary.setSellerId(snapshot.getSellerId());
        summary.setProductCount((long) nvlInt(snapshot.getProductCount()));
        summary.setACount((long) nvlInt(snapshot.getACount()));
        summary.setBCount((long) nvlInt(snapshot.getBCount()));
        summary.setCCount((long) nvlInt(snapshot.getCCount()));
        summary.setDCount((long) nvlInt(snapshot.getDCount()));
        summary.setUnknownCount((long) nvlInt(snapshot.getUnknownCount()));
        summary.setAbCount((long) nvlInt(snapshot.getAbCount()));
        summary.setAbcCount((long) nvlInt(snapshot.getAbcCount()));
        summary.setARatio(decimalToDouble(snapshot.getARatio()));
        summary.setAbRatio(decimalToDouble(snapshot.getAbRatio()));
        summary.setAbcRatio(decimalToDouble(snapshot.getAbcRatio()));
        summary.setDRatio(decimalToDouble(snapshot.getDRatio()));
        summary.setTopACategory(snapshot.getTopACategory());
        summary.setTopABCCategory(snapshot.getTopABCCategory());
        summary.setTopDCategory(snapshot.getTopDCategory());
        summary.setProfileType(snapshot.getProfileType());
        summary.setLatestBatchDate(snapshot.getBatchDate());
        summary.setVariationMode(snapshot.getVariationMode());
        return summary;
    }

    private void completeSummary(ShopProfileSummary summary) {
        long productCount = nvl(summary.getProductCount());
        long a = nvl(summary.getACount());
        long b = nvl(summary.getBCount());
        long c = nvl(summary.getCCount());
        long d = nvl(summary.getDCount());
        long unknown = nvl(summary.getUnknownCount());
        long ab = a + b;
        long abc = a + b + c;

        summary.setProductCount(productCount);
        summary.setACount(a);
        summary.setBCount(b);
        summary.setCCount(c);
        summary.setDCount(d);
        summary.setUnknownCount(unknown);
        summary.setAbCount(ab);
        summary.setAbcCount(abc);
        summary.setARatio(ratio(a, productCount));
        summary.setAbRatio(ratio(ab, productCount));
        summary.setAbcRatio(ratio(abc, productCount));
        summary.setDRatio(ratio(d, productCount));
        summary.setVariationMode(VARIATION_MODE_NO_VARIANTS);
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

    private String resolveBatchDate(String marketplace, String batchDate) {
        if (StringUtils.hasText(batchDate)) {
            return batchDate.trim();
        }
        if (!StringUtils.hasText(marketplace)) {
            return null;
        }
        return dengZongShopService.getMaxBatchDate(marketplace);
    }

    private String resolveSnapshotBatchDate(String marketplace, String batchDate) {
        if (StringUtils.hasText(batchDate)) {
            return batchDate.trim();
        }
        LambdaQueryWrapper<ShopProfileSnapshot> wrapper = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(marketplace)) {
            wrapper.eq(ShopProfileSnapshot::getMarketplace, marketplace);
        }
        wrapper.eq(ShopProfileSnapshot::getVariationMode, VARIATION_MODE_NO_VARIANTS)
                .orderByDesc(ShopProfileSnapshot::getBatchDate)
                .last("LIMIT 1");
        ShopProfileSnapshot latest = snapshotMapper.selectOne(wrapper);
        if (latest == null || !StringUtils.hasText(latest.getBatchDate())) {
            throw new IllegalArgumentException("未找到店铺画像快照，请先执行 POST /api/v1/shop-profile/compute");
        }
        return latest.getBatchDate();
    }

    private String requireMarketplace(String marketplace) {
        return MarketplaceSupport.require(marketplace);
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

    private String normalizeCode(String code, String message) {
        if (!StringUtils.hasText(code)) {
            throw new IllegalArgumentException(message);
        }
        return code.trim().toUpperCase(Locale.ROOT);
    }

    private String shopKey(String marketplace, String sellerName) {
        return (marketplace == null ? "" : marketplace.trim().toUpperCase(Locale.ROOT)) + "\u0001" +
                (sellerName == null ? "" : sellerName.trim());
    }

    private int nvlInt(Integer value) {
        return value == null ? 0 : value;
    }

    private double decimalToDouble(BigDecimal value) {
        return value == null ? 0.0 : value.doubleValue();
    }

    private BigDecimal doubleToDecimal(Double value) {
        return BigDecimal.valueOf(value == null ? 0.0 : value).setScale(4, RoundingMode.HALF_UP);
    }

    private double round(double value) {
        return BigDecimal.valueOf(value).setScale(4, RoundingMode.HALF_UP).doubleValue();
    }

    private record BaselineMetrics(
            int shopCount,
            double avgProductCount,
            double avgARatio,
            double avgAbRatio,
            double avgAbcRatio,
            double avgDRatio,
            Set<String> topACategories,
            Set<String> topAbcCategories,
            Set<String> topDCategories
    ) {
        private static BaselineMetrics from(List<ShopProfileSnapshot> snapshots) {
            int count = snapshots.size();
            double avgProduct = snapshots.stream().mapToInt(item -> item.getProductCount() == null ? 0 : item.getProductCount()).average().orElse(0);
            double avgA = snapshots.stream().mapToDouble(item -> item.getARatio() == null ? 0 : item.getARatio().doubleValue()).average().orElse(0);
            double avgAb = snapshots.stream().mapToDouble(item -> item.getAbRatio() == null ? 0 : item.getAbRatio().doubleValue()).average().orElse(0);
            double avgAbc = snapshots.stream().mapToDouble(item -> item.getAbcRatio() == null ? 0 : item.getAbcRatio().doubleValue()).average().orElse(0);
            double avgD = snapshots.stream().mapToDouble(item -> item.getDRatio() == null ? 0 : item.getDRatio().doubleValue()).average().orElse(0);
            Set<String> topA = snapshots.stream().map(ShopProfileSnapshot::getTopACategory).filter(StringUtils::hasText).collect(Collectors.toCollection(HashSet::new));
            Set<String> topAbc = snapshots.stream().map(ShopProfileSnapshot::getTopABCCategory).filter(StringUtils::hasText).collect(Collectors.toCollection(HashSet::new));
            Set<String> topD = snapshots.stream().map(ShopProfileSnapshot::getTopDCategory).filter(StringUtils::hasText).collect(Collectors.toCollection(HashSet::new));
            return new BaselineMetrics(count, avgProduct, avgA, avgAb, avgAbc, avgD, topA, topAbc, topD);
        }
    }
}
