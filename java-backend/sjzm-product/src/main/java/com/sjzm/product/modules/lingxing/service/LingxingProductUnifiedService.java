package com.sjzm.product.modules.lingxing.service;

import com.sjzm.common.PageResult;
import com.sjzm.product.mapper.LingxingProductUnifiedMapper;
import com.sjzm.product.modules.lingxing.dto.LingxingShopProductVO;
import com.sjzm.product.modules.lingxing.dto.LingxingShopQueryRequest;
import com.sjzm.product.rds.service.RdsBatchWriteService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 领星产品统一表加工服务（ASIN 维度宽表）。
 *
 * <p>纯读库加工，不调领星 API：周表聚合经营指标 + FBA首现，
 * + {@code lingxing_local_product} 取 developer + {@code lingxing_listing} 取真实上架日。</p>
 *
 * <p>真实上架日期（{@code listing_date}）= 4 信号取最早（精确到日），首次写入后锁定：
 * <ul>
 *   <li>信号1 FBA可售首现（afn&gt;0 最早 week_start）</li>
 *   <li>信号2 可用库存首现（FBA可售+待调仓+预留+入库中 &gt;0 最早 week_start）</li>
 *   <li>信号3 销量首现（volume&gt;0 最早 week_start）</li>
 *   <li>信号4 真实上架日（listing.open_date），再兜底 product_create_time</li>
 * </ul>
 *
 * <p>经营指标（销量/利润/快照）每周全量刷新。</p>
 *
 * <p>每周产品表现同步后由 {@link LingxingScheduledSyncService} 调用。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LingxingProductUnifiedService {

    /** 统一表算法版本（口径变更时递增） */
    public static final String UNIFIED_VERSION = "UNIFIED_V4_2026-08-11";

    private final LingxingProductUnifiedMapper mapper;
    private final RdsBatchWriteService rdsBatchWriteService;

    /**
     * 增量重算产品统一表：新 ASIN INSERT（真实上架日期一次写入）+ 已有 ASIN UPDATE（只刷新经营指标）。
     *
     * @param cutoffMonth 数据覆盖截止月（如 2026-07，写入元数据列；可空）
     * @return {inserted, updated, version}
     */
    public Map<String, Object> rebuild(String cutoffMonth) {
        long t0 = System.currentTimeMillis();
        int[] affected = rdsBatchWriteService.executeOne(LingxingProductUnifiedMapper.class, rdsMapper ->
                new int[]{
                        rdsMapper.rebuildAll(cutoffMonth, UNIFIED_VERSION),
                        rdsMapper.updateMetrics(cutoffMonth, UNIFIED_VERSION),
                        rdsMapper.upsertMarketplaceRelations(),
                        rdsMapper.deactivateStaleMarketplaceRelations()
                });
        int inserted = affected[0];
        int updated = affected[1];
        int marketplaceUpserted = affected[2];
        int marketplaceDeactivated = affected[3];
        long ms = System.currentTimeMillis() - t0;
        log.info("领星产品统一表重算完成：新ASIN {} 行（真实上架日期已锁定），刷新经营指标 {} 行，耗时 {}ms，version={}",
                inserted, updated, ms, UNIFIED_VERSION);
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("inserted", inserted);
        r.put("updated", updated);
        r.put("marketplaceUpserted", marketplaceUpserted);
        r.put("marketplaceDeactivated", marketplaceDeactivated);
        r.put("version", UNIFIED_VERSION);
        r.put("costMs", ms);
        return r;
    }

    // ============================================================
    // 领星店铺数据选品页（只读查询）
    // ============================================================

    /** 分页查询店铺数据选品卡片（图片双兜底 + 按店铺/站点等筛选）。 */
    public PageResult<LingxingShopProductVO> queryShopProducts(LingxingShopQueryRequest req) {
        int page = req.getPage() == null || req.getPage() < 1 ? 1 : req.getPage();
        int size = req.getSize() == null || req.getSize() < 1 ? 20 : Math.min(req.getSize(), 200);
        long total = mapper.countShopProducts(req);
        if (total == 0) {
            return PageResult.empty((long) page, (long) size);
        }
        List<LingxingShopProductVO> list = mapper.selectShopProducts(req, (long) (page - 1) * size, size);
        return PageResult.of(list, total, (long) page, (long) size);
    }

    /** "按领星店铺分类"下拉：各 base_store 及其商品数（country 可空=全部）。 */
    public List<Map<String, Object>> listShopStores(String country) {
        return mapper.selectShopStores(country);
    }
}
