package com.sjzm.product.modules.shoppremium.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.sjzm.common.PageResult;
import com.sjzm.product.modules.shopcandidate.entity.ShopCandidatePool;
import com.sjzm.product.modules.shopcandidate.mapper.ShopCandidatePoolMapper;
import com.sjzm.product.modules.shopcollection.mapper.ShopProductMapper;
import com.sjzm.product.modules.shoppremium.entity.ShopPremiumPool;
import com.sjzm.product.modules.shoppremium.mapper.ShopPremiumPoolMapper;
import com.sjzm.product.modules.requestcenter.service.SellerspriteRequestCenterService;
import com.sjzm.product.modules.requestcenter.service.SellerspriteRequestCenterService.RequestItemInput;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 精品店铺池——长期复用、周期复抓。
 *
 * <p>入池前置（硬约束）：
 * <ul>
 *   <li>从候选池入池：候选必须已 {@code FETCHED}（抓过全集+看过画像）。</li>
 *   <li>人工/观察池入池：该店必须已有成功的 {@code shop_products} 快照。</li>
 *   <li>同店已 {@code REMOVED} 时恢复原行，不创建重复精品店。</li>
 * </ul></p>
 *
 * <p>复抓只做 dry-run 预览 + 创建请求中心任务，不直接同步批量抓取（避免无控制地消耗使用次数）。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ShopPremiumService {

    private final ShopPremiumPoolMapper premiumMapper;
    private final ShopCandidatePoolMapper candidateMapper;
    private final ShopProductMapper shopProductMapper;
    private final SellerspriteRequestCenterService requestCenterService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final Set<String> VALID_STATUSES = Set.of("ACTIVE", "PAUSED", "REMOVED");
    private static final Set<String> VALID_QUALITY = Set.of("HIGH", "MID", "LOW");
    private static final Set<String> VALID_FREQ = Set.of("WEEKLY", "MONTHLY", "MANUAL");

    // ── promote from candidate ───────────────────────────────────

    /**
     * 从候选池提升到精品池。候选必须已 FETCHED，成功后候选状态推进到 PROMOTED 并回填 premium_id。
     */
    @Transactional
    public ShopPremiumPool promoteFromCandidate(Long candidateId, String tagsJson, String qualityLevel,
                                                String refreshFrequency, String note) {
        ShopCandidatePool candidate = candidateMapper.selectById(candidateId);
        if (candidate == null) throw new IllegalArgumentException("候选记录不存在: " + candidateId);
        if (!"FETCHED".equals(candidate.getStatus())) {
            throw new IllegalStateException("候选记录必须已 FETCHED 才能入精品池，当前: " + candidate.getStatus());
        }
        // 校验有成功快照
        int snapshot = shopProductMapper.countByMarketplaceAndSeller(
                candidate.getMarketplace(), candidate.getSellerName());
        if (snapshot == 0) {
            throw new IllegalStateException("候选已 FETCHED 但 shop_products 无快照，数据不一致，拒绝入池");
        }

        ShopPremiumPool premium = findOrCreatePremium(candidate, "CANDIDATE_PROMOTE", candidateId,
                candidate.getReason(), tagsJson, qualityLevel, refreshFrequency, note);
        // 从候选抓取记录回填 last_fetch_run_id / last_fetch_date（计划三-3 要求）
        if (StringUtils.hasText(candidate.getFetchRunId())) {
            premium.setLastFetchRunId(candidate.getFetchRunId());
            premium.setLastFetchDate(LocalDate.now().format(DATE_FMT));
            premiumMapper.updateById(premium);
        }
        // 候选状态推进到 PROMOTED，回填 premium_id
        candidate.setStatus("PROMOTED");
        candidate.setPremiumId(premium.getId());
        candidateMapper.updateById(candidate);
        log.info("精品池入池(候选提升): candidateId={}, premiumId={}, seller={}",
                candidateId, premium.getId(), candidate.getSellerName());
        return premium;
    }

    // ── add manual / from watchlist ──────────────────────────────

    /**
     * 人工加入精品池。前置：该店必须有成功 shop_products 快照（除非 forceCreateImmediately=true 且立即触发抓取）。
     */
    @Transactional
    public ShopPremiumPool addManual(String marketplace, String sellerName, String reason, String tagsJson,
                                     String qualityLevel, String refreshFrequency, String note,
                                     boolean forceCreateImmediately) {
        if (!StringUtils.hasText(marketplace) || !StringUtils.hasText(sellerName)) {
            throw new IllegalArgumentException("marketplace 和 sellerName 不能为空");
        }
        String mp = marketplace.trim().toUpperCase(Locale.ROOT);
        String seller = sellerName.trim();
        if (!forceCreateImmediately) {
            int snapshot = shopProductMapper.countByMarketplaceAndSeller(mp, seller);
            if (snapshot == 0) {
                throw new IllegalStateException("该店尚无成功 shop_products 快照，无法入精品池。"
                        + "如需先强制加入并后续手动发起复抓，请传 forceCreateImmediately=true");
            }
        }
        ShopPremiumPool placeholder = new ShopPremiumPool();
        placeholder.setMarketplace(mp);
        placeholder.setSellerName(seller);
        placeholder.setReason(StringUtils.hasText(reason) ? reason.trim() : "人工加入");
        return findOrCreatePremium(placeholder, "MANUAL", null,
                StringUtils.hasText(reason) ? reason.trim() : "人工加入",
                tagsJson, qualityLevel, refreshFrequency, note);
    }

    // ── update / status / refresh ────────────────────────────────

    @Transactional
    public ShopPremiumPool update(Long id, String tagsJson, String qualityLevel, String refreshFrequency,
                                  String reason, String note) {
        ShopPremiumPool entity = premiumMapper.selectById(id);
        if (entity == null) throw new IllegalArgumentException("精品店不存在: " + id);
        if ("REMOVED".equals(entity.getStatus())) {
            throw new IllegalStateException("已移除的精品店不能修改，请先恢复");
        }
        if (StringUtils.hasText(tagsJson)) entity.setTagsJson(tagsJson);
        if (StringUtils.hasText(qualityLevel)) entity.setQualityLevel(normalizeQuality(qualityLevel));
        if (StringUtils.hasText(refreshFrequency)) entity.setRefreshFrequency(normalizeFreq(refreshFrequency));
        if (StringUtils.hasText(reason)) entity.setReason(reason);
        if (StringUtils.hasText(note)) entity.setNote(note);
        premiumMapper.updateById(entity);
        return entity;
    }

    @Transactional
    public int updateStatus(Long id, String status) {
        String s = normalizeStatus(status);
        ShopPremiumPool entity = premiumMapper.selectById(id);
        if (entity == null) throw new IllegalArgumentException("精品店不存在: " + id);
        entity.setStatus(s);
        return premiumMapper.updateById(entity);
    }

    // ── refresh (dry-run + create request center task) ───────────

    /**
     * dry-run 复抓预览——不消耗使用次数，返回将复抓哪些店、哪些已暂停/未到期/状态不允许。
     */
    public Map<String, Object> refreshDryRun(List<Long> premiumIds) {
        List<ShopPremiumPool> all = premiumIds == null ? List.of()
                : premiumIds.stream().map(premiumMapper::selectById).filter(Objects::nonNull).toList();
        List<Map<String, Object>> toRefresh = new ArrayList<>();
        List<Map<String, Object>> skipped = new ArrayList<>();
        for (ShopPremiumPool p : all) {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("premiumId", p.getId());
            entry.put("marketplace", p.getMarketplace());
            entry.put("sellerName", p.getSellerName());
            entry.put("status", p.getStatus());
            entry.put("refreshStatus", p.getRefreshStatus());
            entry.put("nextFetchDate", p.getNextFetchDate());
            if (!"ACTIVE".equals(p.getStatus())) {
                entry.put("reason", "status 非 ACTIVE（" + p.getStatus() + "），跳过");
                skipped.add(entry);
            } else if (!"IDLE".equals(p.getRefreshStatus()) && !"FAILED".equals(p.getRefreshStatus())) {
                entry.put("reason", "refresh_status=" + p.getRefreshStatus() + "，已有复抓在跑");
                skipped.add(entry);
            } else {
                toRefresh.add(entry);
            }
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalRequested", all.size());
        result.put("toRefreshCount", toRefresh.size());
        result.put("skippedCount", skipped.size());
        result.put("estimatedApiCallsLowerBound", toRefresh.size());
        result.put("toRefresh", toRefresh);
        result.put("skipped", skipped);
        result.put("note", "dry-run 预览，未创建任务，未消耗使用次数");
        return result;
    }

    /**
     * 创建复抓任务——dry-run 通过后调用，入请求中心，不立即抓取。
     * @return 请求中心 run（含 runId），前端轮询 consumeNext 推进。
     */
    @Transactional
    public Map<String, Object> createRefreshTask(List<Long> premiumIds, String operator) {
        if (premiumIds == null || premiumIds.isEmpty()) {
            throw new IllegalArgumentException("premiumIds 不能为空");
        }
        Map<String, Object> dryRun = refreshDryRun(premiumIds);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> toRefresh = (List<Map<String, Object>>) dryRun.get("toRefresh");
        if (toRefresh.isEmpty()) {
            throw new IllegalStateException("没有可复抓的精品店（全部已暂停/未到期/状态不允许）");
        }
        // 抢锁：ACTIVE + IDLE/FAILED → RUNNING
        List<RequestItemInput> items = new ArrayList<>();
        List<Long> lockedIds = new ArrayList<>();
        for (Map<String, Object> entry : toRefresh) {
            Long id = ((Number) entry.get("premiumId")).longValue();
            int locked = premiumMapper.lockForRefresh(id);
            if (locked == 0) {
                log.info("精品池复抓抢锁失败: premiumId={}（并发或状态变更）", id);
                continue;
            }
            lockedIds.add(id);
            String mp = (String) entry.get("marketplace");
            String seller = (String) entry.get("sellerName");
            items.add(new RequestItemInput(mp, seller, id));
        }
        if (items.isEmpty()) {
            throw new IllegalStateException("所有候选精品店抢锁失败，无法创建复抓任务");
        }

        String triggerRef = objectMapper.valueToTree(lockedIds).toString();
        Map<String, Object> taskResult = requestCenterService.createRepeatableShopTask(
                null, triggerRef, "精品池周期复抓", items, operator);

        // 请求中心按店铺全局活跃状态再次去重时，释放本次先抢到但未入队的精品行。
        Object skippedValue = taskResult.get("skippedShops");
        Set<String> skippedKeys = skippedValue instanceof List<?> list
                ? list.stream().map(String::valueOf).map(value -> value.toUpperCase(Locale.ROOT)).collect(Collectors.toSet())
                : Set.of();
        if (!skippedKeys.isEmpty()) {
            for (Map<String, Object> entry : toRefresh) {
                Long id = ((Number) entry.get("premiumId")).longValue();
                String key = String.valueOf(entry.get("marketplace")).trim().toUpperCase(Locale.ROOT)
                        + ":" + String.valueOf(entry.get("sellerName")).trim().toUpperCase(Locale.ROOT);
                if (skippedKeys.contains(key)) {
                    premiumMapper.markRefreshStopped(id, "请求中心检测到已有活跃店铺任务，未重复入队");
                }
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.putAll(taskResult);
        result.put("toRefreshCount", taskResult.get("queuedCount"));
        result.put("lockedPremiumIds", lockedIds);
        result.put("message", "精品周期复抓任务已创建；允许历史成功店铺再次抓取，但活跃任务不会重复创建");
        return result;
    }

    // ── list / detail / delete ───────────────────────────────────

    public PageResult<ShopPremiumPool> list(String marketplace, String status, String qualityLevel,
                                            String refreshFrequency, String tag, String sellerName,
                                            Integer page, Integer size) {
        int p = Math.max(1, page == null ? 1 : page);
        int s = Math.max(1, Math.min(size == null ? 50 : size, 200));
        LambdaQueryWrapper<ShopPremiumPool> qw = new LambdaQueryWrapper<ShopPremiumPool>()
                .eq(StringUtils.hasText(marketplace), ShopPremiumPool::getMarketplace, marketplace)
                .eq(StringUtils.hasText(status), ShopPremiumPool::getStatus, status)
                .eq(StringUtils.hasText(qualityLevel), ShopPremiumPool::getQualityLevel, qualityLevel)
                .eq(StringUtils.hasText(refreshFrequency), ShopPremiumPool::getRefreshFrequency, refreshFrequency)
                .like(StringUtils.hasText(sellerName), ShopPremiumPool::getSellerName, sellerName)
                // tag 在 JSON 里，用 like 粗筛（精确筛选可在应用层做）
                .like(StringUtils.hasText(tag), ShopPremiumPool::getTagsJson, tag)
                .orderByDesc(ShopPremiumPool::getUpdatedAt);
        Page<ShopPremiumPool> mpPage = new Page<>(p, s);
        Page<ShopPremiumPool> result = premiumMapper.selectPage(mpPage, qw);
        return PageResult.of(result.getRecords(), result.getTotal(), (long) p, (long) s);
    }

    public ShopPremiumPool getById(Long id) {
        ShopPremiumPool entity = premiumMapper.selectById(id);
        if (entity == null) throw new IllegalArgumentException("精品店不存在: " + id);
        return entity;
    }

    /** 软删除（REMOVED），不物理删除，便于同店再加入时恢复。 */
    @Transactional
    public int remove(Long id) {
        ShopPremiumPool entity = premiumMapper.selectById(id);
        if (entity == null) throw new IllegalArgumentException("精品店不存在: " + id);
        entity.setStatus("REMOVED");
        return premiumMapper.updateById(entity);
    }

    // ── internal helpers ─────────────────────────────────────────

    /**
     * 查找或创建精品店——同店已有 ACTIVE 记录则更新，REMOVED 则恢复，否则新建。
     */
    private ShopPremiumPool findOrCreatePremium(ShopCandidatePool candidate, String sourceType, Long sourceId,
                                                String reason, String tagsJson, String qualityLevel,
                                                String refreshFrequency, String note) {
        ShopPremiumPool placeholder = new ShopPremiumPool();
        placeholder.setMarketplace(candidate.getMarketplace());
        placeholder.setSellerName(candidate.getSellerName());
        placeholder.setSellerId(candidate.getSellerId());
        return findOrCreatePremium(placeholder, sourceType, sourceId, reason, tagsJson,
                qualityLevel, refreshFrequency, note);
    }

    private ShopPremiumPool findOrCreatePremium(ShopPremiumPool template, String sourceType, Long sourceId,
                                                String reason, String tagsJson, String qualityLevel,
                                                String refreshFrequency, String note) {
        String mp = template.getMarketplace();
        String seller = template.getSellerName();
        ShopPremiumPool existing = premiumMapper.selectOne(new LambdaQueryWrapper<ShopPremiumPool>()
                .eq(ShopPremiumPool::getMarketplace, mp)
                .eq(ShopPremiumPool::getSellerName, seller));
        if (existing != null) {
            if ("REMOVED".equals(existing.getStatus())) {
                // 恢复：更新来源/原因/标签/质量/频率，置 ACTIVE
                premiumMapper.restoreRemoved(mp, seller, sourceType, sourceId, reason,
                        tagsJson, normalizeQuality(qualityLevel), normalizeFreq(refreshFrequency));
                existing = premiumMapper.selectById(existing.getId());
            } else {
                // 已存在且非 REMOVED：更新可变字段，不动 status
                existing.setSourceType(sourceType);
                existing.setSourceId(sourceId);
                existing.setReason(reason);
                if (StringUtils.hasText(tagsJson)) existing.setTagsJson(tagsJson);
                if (StringUtils.hasText(qualityLevel)) existing.setQualityLevel(normalizeQuality(qualityLevel));
                if (StringUtils.hasText(refreshFrequency)) existing.setRefreshFrequency(normalizeFreq(refreshFrequency));
                if (StringUtils.hasText(note)) existing.setNote(note);
                if (StringUtils.hasText(template.getSellerId())) existing.setSellerId(template.getSellerId());
                premiumMapper.updateById(existing);
            }
            return existing;
        }
        template.setSourceType(sourceType);
        template.setSourceId(sourceId);
        template.setReason(reason);
        template.setTagsJson(tagsJson);
        template.setQualityLevel(normalizeQuality(qualityLevel));
        template.setRefreshFrequency(normalizeFreq(refreshFrequency));
        template.setNote(note);
        template.setRefreshStatus("IDLE");
        template.setStatus("ACTIVE");
        premiumMapper.insert(template);
        return template;
    }

    private String normalizeQuality(String q) {
        if (!StringUtils.hasText(q)) return "MID";
        String s = q.trim().toUpperCase(Locale.ROOT);
        if (!VALID_QUALITY.contains(s)) throw new IllegalArgumentException("qualityLevel 仅支持: " + VALID_QUALITY);
        return s;
    }

    private String normalizeFreq(String f) {
        if (!StringUtils.hasText(f)) return "MONTHLY";
        String s = f.trim().toUpperCase(Locale.ROOT);
        if (!VALID_FREQ.contains(s)) throw new IllegalArgumentException("refreshFrequency 仅支持: " + VALID_FREQ);
        return s;
    }

    private String normalizeStatus(String status) {
        if (!StringUtils.hasText(status)) throw new IllegalArgumentException("status 不能为空");
        String s = status.trim().toUpperCase(Locale.ROOT);
        if (!VALID_STATUSES.contains(s)) throw new IllegalArgumentException("status 仅支持: " + VALID_STATUSES);
        return s;
    }
}
