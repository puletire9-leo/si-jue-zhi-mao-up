package com.sjzm.product.modules.shopcollection.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sjzm.product.modules.shopcollection.entity.ShopWatchlist;
import com.sjzm.product.modules.shopcollection.mapper.ShopWatchlistMapper;
import com.sjzm.product.modules.shoprating.dto.ShopMethodRankItem;
import com.sjzm.product.modules.shoprating.service.ShopMethodRankService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * 店铺观察池：把"方法卡命中→哪些店值得盯"这个判断固化下来，驱动后续店铺全集抓取。
 *
 * <p>核心入口 {@link #syncFromMethodRank}：跑一遍方法卡店铺排名（如 M01），
 * 把命中数达标的店铺 upsert 进 shop_watchlist，记录进入原因（source_type=METHOD_CARD、
 * source_code=方法卡ID、reason、hit_count、top_category）。人工也可直接增删观察池。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ShopWatchlistService {

    private final ShopWatchlistMapper mapper;
    private final ShopMethodRankService methodRankService;

    /**
     * @deprecated 已被 {@link com.sjzm.product.modules.shopcandidate.service.ShopCandidateService#syncFromMethodRank}
     * 取代。新链路：方法卡命中只落 {@code shop_candidate_pool}（候选池），人工确认后才进观察池。
     * <p>本方法仍保留向后兼容，但新链路前端应调用 {@code /api/v1/modules/shop-candidates/sync-from-method-rank}
     * 而非 {@code /api/v1/modules/shop-collection/watchlist/sync-from-method-rank}。
     * <p>历史 {@code shop_watchlist.source_type=METHOD_CARD} 数据视为过渡态，改造后由候选池回填，
     * 或保留只读、新链路不再写入。</p>
     */
    @Deprecated(since = "店铺候选池链路落地", forRemoval = true)
    public Map<String, Object> syncFromMethodRank(String methodId, String marketplace, Integer minCount) {
        String method = normalizeMethodId(methodId);
        int min = minCount == null || minCount < 1 ? 1 : minCount;
        List<ShopMethodRankItem> ranking = methodRankService.rankByMethod(method, marketplace, min, 500);

        int upserted = 0;
        for (ShopMethodRankItem item : ranking) {
            if (item.getSellerName() == null || item.getSellerName().isBlank()) continue;
            ShopWatchlist entity = new ShopWatchlist();
            entity.setMarketplace(item.getMarketplace());
            entity.setSellerName(item.getSellerName());
            entity.setSourceType("METHOD_CARD");
            entity.setSourceCode(method);
            entity.setHitCount(item.getHitCount());
            entity.setTopCategory(item.getTopCategory());
            entity.setReason(buildReason(method, item));
            entity.setStatus("WATCHING");
            mapper.upsert(entity);
            upserted++;
        }

        log.info("观察池同步完成: methodId={}, marketplace={}, ranked={}, upserted={}",
                method, marketplace, ranking.size(), upserted);
        Map<String, Object> result = new HashMap<>();
        result.put("methodId", method);
        result.put("marketplace", marketplace);
        result.put("minCount", min);
        result.put("rankedShops", ranking.size());
        result.put("upserted", upserted);
        return result;
    }

    /** 人工加入观察池（source_type=MANUAL）。 */
    public ShopWatchlist addManual(String marketplace, String sellerName, String reason) {
        if (!StringUtils.hasText(marketplace) || !StringUtils.hasText(sellerName)) {
            throw new IllegalArgumentException("marketplace 和 sellerName 不能为空");
        }
        ShopWatchlist entity = new ShopWatchlist();
        entity.setMarketplace(marketplace.trim().toUpperCase(Locale.ROOT));
        entity.setSellerName(sellerName.trim());
        entity.setSourceType("MANUAL");
        entity.setSourceCode("");
        entity.setReason(StringUtils.hasText(reason) ? reason.trim() : "人工加入");
        entity.setStatus("WATCHING");
        mapper.upsert(entity);
        return entity;
    }

    public List<ShopWatchlist> list(String marketplace, String status, String sourceType) {
        LambdaQueryWrapper<ShopWatchlist> qw = new LambdaQueryWrapper<ShopWatchlist>()
                .eq(StringUtils.hasText(marketplace), ShopWatchlist::getMarketplace, marketplace)
                .eq(StringUtils.hasText(status), ShopWatchlist::getStatus, status)
                .eq(StringUtils.hasText(sourceType), ShopWatchlist::getSourceType, sourceType)
                .orderByDesc(ShopWatchlist::getHitCount)
                .orderByDesc(ShopWatchlist::getUpdatedAt);
        return mapper.selectList(qw);
    }

    public int updateStatus(Long id, String status) {
        ShopWatchlist entity = mapper.selectById(id);
        if (entity == null) {
            throw new IllegalArgumentException("观察池记录不存在: " + id);
        }
        entity.setStatus(normalizeStatus(status));
        return mapper.updateById(entity);
    }

    public int remove(Long id) {
        return mapper.deleteById(id);
    }

    /** 标记某观察池记录已抓取，记录本次抓取 runId。 */
    public void markFetched(Long id, String runId) {
        if (id == null) return;
        ShopWatchlist entity = mapper.selectById(id);
        if (entity == null) return;
        entity.setStatus("FETCHED");
        entity.setLastFetchRunId(runId);
        mapper.updateById(entity);
    }

    private String buildReason(String methodId, ShopMethodRankItem item) {
        StringBuilder sb = new StringBuilder(methodId).append(" 命中 ").append(item.getHitCount()).append(" 个合格新品");
        if (StringUtils.hasText(item.getTopCategory())) {
            sb.append("，主打 ").append(item.getTopCategory());
        }
        return sb.toString();
    }

    private String normalizeMethodId(String methodId) {
        if (!StringUtils.hasText(methodId)) return "M01";
        return methodId.trim().toUpperCase(Locale.ROOT);
    }

    private String normalizeStatus(String status) {
        if (!StringUtils.hasText(status)) {
            throw new IllegalArgumentException("status 不能为空");
        }
        String s = status.trim().toUpperCase(Locale.ROOT);
        return switch (s) {
            case "WATCHING", "FETCHED", "CONFIRMED", "IGNORED" -> s;
            default -> throw new IllegalArgumentException("status 仅支持 WATCHING/FETCHED/CONFIRMED/IGNORED");
        };
    }
}
