package com.sjzm.product.modules.lingxing.service;

import com.sjzm.product.mapper.LingxingProductUnifiedMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 领星产品统一表加工服务（ASIN 维度宽表）。
 *
 * <p>纯读库加工，不调领星 API：月表 {@code lingxing_asin_monthly_performance} 聚合经营指标
 * + {@code lingxing_asin_baseline} 取身份/起算月/FBA首现（4级兜底口径由 Python maintain 脚本预先算好落 baseline）
 * + {@code lingxing_listing} 取真实上架日 open_date。</p>
 *
 * <p>全量重算走一条 {@code INSERT ... ON DUPLICATE KEY UPDATE}（见 Mapper XML），
 * 每 ASIN 一行、幂等可重跑。每周产品表现同步后由 {@link LingxingScheduledSyncService} 调用。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LingxingProductUnifiedService {

    /** 统一表算法版本（口径变更时递增） */
    public static final String UNIFIED_VERSION = "UNIFIED_V1_2026-07-30";

    private final LingxingProductUnifiedMapper mapper;

    /**
     * 全量重算产品统一表。
     *
     * @param cutoffMonth 数据覆盖截止月（如 2026-06，写入元数据列；可空则用 baseline 口径）
     * @return {affected, version}
     */
    /**
     * 全量重算：先清空再写入，确保非目标标签 ASIN 不会残留。
     * 只允许目标标签 ASIN 进入（绿标/欧洲精铺2025系列/侵权下架）。
     */
    @Transactional
    public Map<String, Object> rebuild(String cutoffMonth) {
        long t0 = System.currentTimeMillis();
        mapper.truncateAll();
        int affected = mapper.rebuildAll(cutoffMonth, UNIFIED_VERSION);
        long ms = System.currentTimeMillis() - t0;
        log.info("领星产品统一表重算完成：仅目标标签 ASIN，写入 {} 行，耗时 {}ms，version={}",
                affected, ms, UNIFIED_VERSION);
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("affected", affected);
        r.put("version", UNIFIED_VERSION);
        r.put("costMs", ms);
        return r;
    }
}