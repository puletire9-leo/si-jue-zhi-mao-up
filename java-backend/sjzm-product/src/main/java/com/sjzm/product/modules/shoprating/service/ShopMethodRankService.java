package com.sjzm.product.modules.shoprating.service;

import com.sjzm.product.mapper.ShopMethodRankMapper;
import com.sjzm.product.methodrule.M01Rule;
import com.sjzm.product.modules.shoprating.dto.ShopMethodRankItem;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * 店铺方法卡命中数排名 + m01_active 每日摘标。
 *
 * <p>店铺品级 = 按方法卡（M01）标准，这家店产出了多少合格新品。命中数越多越值得盯，
 * 是"选店铺找稳定新品货源"的核心。与相似度评级（ShopRatingServiceImpl）并存。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ShopMethodRankService {

    private final ShopMethodRankMapper mapper;

    /** 支持 M01 的站点，摘标任务遍历它们。 */
    private static final String[] MARKETPLACES = {"UK", "DE", "US"};

    /**
     * 按 M01 命中数给店铺排名。
     * @param marketplace 站点
     * @param minCount    命中数下限（默认 1）
     * @param limit       返回条数上限（默认 100）
     */
    public List<ShopMethodRankItem> rankByM01(String marketplace, Integer minCount, Integer limit) {
        String mp = normalizeRankMarketplace(marketplace);
        int min = minCount == null || minCount < 1 ? 1 : minCount;
        int lim = limit == null || limit < 1 ? 100 : Math.min(limit, 500);
        return mapper.selectM01ShopRanking(mp, min, lim);
    }

    private String normalizeRankMarketplace(String marketplace) {
        if (marketplace == null || marketplace.isBlank()) {
            return null;
        }
        String mp = marketplace.trim().toUpperCase(Locale.ROOT);
        return "ALL".equals(mp) ? null : M01Rule.normalizeMarketplace(mp);
    }

    public Map<String, Object> backfillM01Active(String marketplace) {
        String mp = M01Rule.normalizeMarketplace(marketplace);
        M01Rule rule = M01Rule.forMarketplace(mp);
        int raw = mapper.backfillM01Active(
                rule.marketplace(),
                rule.priceMin(),
                rule.priceMax(),
                rule.weightMax(),
                rule.listingDaysMax(),
                rule.sales30(),
                rule.sales60(),
                rule.sales90(),
                rule.bsrMax()
        );
        int clean = mapper.syncCleanM01Active(rule.marketplace());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("marketplace", rule.marketplace());
        result.put("methodId", "M01");
        result.put("rawAffectedRows", raw);
        result.put("cleanAffectedRows", clean);
        return result;
    }

    /**
     * 每天 0 点摘标：把上架超期的过期品 m01_active 置 0。
     * 原始表 + 清洗表都处理，各站点分别执行。增量小操作。
     */
    @Scheduled(cron = "${M01_EXPIRE_CRON:0 0 0 * * *}")
    public void expireM01ActiveDaily() {
        for (String mp : MARKETPLACES) {
            try {
                int max = M01Rule.forMarketplace(mp).listingDaysMax();
                int raw = mapper.expireM01Active(mp, max);
                int clean = mapper.expireM01ActiveClean(mp, max);
                if (raw > 0 || clean > 0) {
                    log.info("M01 摘标 [{}]: 原始表 {} 行, 清洗表 {} 行 (上架≥{}天)", mp, raw, clean, max);
                }
            } catch (Exception e) {
                log.error("M01 摘标失败 [{}]: {}", mp, e.getMessage(), e);
            }
        }
    }
}
