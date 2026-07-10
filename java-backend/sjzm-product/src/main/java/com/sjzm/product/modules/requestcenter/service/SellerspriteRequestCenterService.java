package com.sjzm.product.modules.requestcenter.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.sjzm.common.PageResult;
import com.sjzm.product.modules.requestcenter.entity.SellerspriteRequestItem;
import com.sjzm.product.modules.requestcenter.entity.SellerspriteRequestRun;
import com.sjzm.product.modules.requestcenter.mapper.SellerspriteRequestItemMapper;
import com.sjzm.product.modules.requestcenter.mapper.SellerspriteRequestRunMapper;
import com.sjzm.product.modules.shopcandidate.service.ShopCandidateService;
import com.sjzm.product.modules.shopcollection.service.ShopProductSyncService;
import com.sjzm.product.util.WeekTagUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executor;

/**
 * 卖家精灵请求中心最小骨架。
 *
 * <p>统一承接 ASIN、店铺全集、候选池批量、精品复抓的实况、暂停、停止、失败重试和使用次数统计。
 * 第一版不做后台线程消费——通过 {@link #consumeNext} 手动驱动单步消费，调用方（Controller/定时任务/前端轮询）
 * 按 run 推进。2 秒/请求限速由 {@link ShopProductSyncService#syncBySellerName} 内部 throttle 保证。</p>
 *
 * <p>状态机：
 * <ul>
 *   <li>run: PENDING → RUNNING → (PAUSED ↔ RUNNING) → SUCCESS/FAILED/PARTIAL_SUCCESS/STOPPED</li>
 *   <li>item: PENDING → RUNNING → SUCCESS/PARTIAL_SUCCESS/FAILED/SKIPPED</li>
 * </ul></p>
 */
@Slf4j
@Service
public class SellerspriteRequestCenterService {

    private final SellerspriteRequestRunMapper runMapper;
    private final SellerspriteRequestItemMapper itemMapper;
    private final ShopProductSyncService productSyncService;
    private final ShopCandidateService candidateService;
    private final WeekTagUtil weekTagUtil;
    private final TransactionTemplate transactionTemplate;
    @Qualifier("sellerspriteRequestExecutor")
    private final Executor sellerspriteRequestExecutor;
    private final com.sjzm.product.modules.shoppremium.mapper.ShopPremiumPoolMapper premiumMapper;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final int DEFAULT_BATCH_SIZE = 5;
    private static final Set<String> RUNNABLE_STATUS = Set.of("PENDING", "RUNNING");
    private static final Set<String> TERMINAL_STATUS = Set.of("SUCCESS", "FAILED", "PARTIAL_SUCCESS", "STOPPED");
    private final Set<String> activeAutoRuns = ConcurrentHashMap.newKeySet();

    public SellerspriteRequestCenterService(SellerspriteRequestRunMapper runMapper,
                                            SellerspriteRequestItemMapper itemMapper,
                                            ShopProductSyncService productSyncService,
                                            ShopCandidateService candidateService,
                                            WeekTagUtil weekTagUtil,
                                            TransactionTemplate transactionTemplate,
                                            @Qualifier("sellerspriteRequestExecutor") Executor sellerspriteRequestExecutor,
                                            com.sjzm.product.modules.shoppremium.mapper.ShopPremiumPoolMapper premiumMapper) {
        this.runMapper = runMapper;
        this.itemMapper = itemMapper;
        this.productSyncService = productSyncService;
        this.candidateService = candidateService;
        this.weekTagUtil = weekTagUtil;
        this.transactionTemplate = transactionTemplate;
        this.sellerspriteRequestExecutor = sellerspriteRequestExecutor;
        this.premiumMapper = premiumMapper;
    }

    // ── create task ──────────────────────────────────────────────

    /**
     * 创建请求中心任务并入队子项。
     *
     * @param requestType SHOP_FULL_LOOKUP / ASIN_LOOKUP / CANDIDATE_BATCH / PREMIUM_REFRESH
     * @param marketplace 任务级站点
     * @param triggerType CANDIDATE_CONFIRM / WATCHLIST / PREMIUM_REFRESH / MANUAL
     * @param triggerRef  来源引用（如 premium id 列表 JSON），可空
     * @param fetchReason 抓取原因
     * @param items       子项列表（marketplace + sellerName + triggerId）
     * @param operator    操作人，可空
     * @return 创建的 run（含 runId）
     */
    @Transactional
    public SellerspriteRequestRun createTask(String requestType, String marketplace, String triggerType,
                                             String triggerRef, String fetchReason,
                                             List<RequestItemInput> items, String operator) {
        if (items == null || items.isEmpty()) {
            throw new IllegalArgumentException("子项不能为空");
        }
        String runId = "REQ_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        String batchCode = weekTagUtil.currentWeekTag();
        String batchDate = LocalDate.now().format(DATE_FMT);

        SellerspriteRequestRun run = new SellerspriteRequestRun();
        run.setRunId(runId);
        run.setRequestType(requestType);
        run.setMarketplace(resolveTaskMarketplace(marketplace, items));
        run.setTriggerType(triggerType);
        run.setTriggerRef(triggerRef);
        run.setFetchReason(fetchReason);
        run.setBatchCode(batchCode);
        run.setBatchDate(batchDate);
        run.setTotalCount(items.size());
        run.setPendingCount(items.size());
        run.setRunningCount(0);
        run.setSuccessCount(0);
        run.setFailedCount(0);
        run.setSkippedCount(0);
        run.setApiCalls(0);
        run.setStatus("PENDING");
        run.setOperator(operator);
        runMapper.insert(run);

        int seq = 0;
        for (RequestItemInput input : items) {
            SellerspriteRequestItem item = new SellerspriteRequestItem();
            item.setRunId(runId);
            item.setSeq(seq++);
            item.setMarketplace(StringUtils.hasText(input.marketplace()) ? input.marketplace() : marketplace);
            item.setSellerName(input.sellerName());
            item.setTriggerId(input.triggerId());
            item.setStatus("PENDING");
            itemMapper.insert(item);
        }

        log.info("请求中心任务已创建: runId={}, requestType={}, marketplace={}, items={}",
                runId, requestType, marketplace, items.size());
        startAutoConsumeAfterCommit(runId);
        return run;
    }

    // ── dry-run preview ──────────────────────────────────────────

    /**
     * dry-run 预览——不创建任务，返回将处理的子项和预计消耗。
     * 调用方传入候选列表，服务检查哪些可抓、哪些已暂停/未到期/状态不允许，返回分类预览。
     */
    public Map<String, Object> dryRunPreview(String requestType, String marketplace,
                                             List<RequestItemInput> items, String description) {
        Map<String, Object> preview = new LinkedHashMap<>();
        preview.put("requestType", requestType);
        preview.put("marketplace", marketplace);
        preview.put("description", description);
        preview.put("totalCount", items == null ? 0 : items.size());
        preview.put("estimatedApiCallsPerShop", 1); // 一页一次，实际按 total 分页
        preview.put("estimatedApiCallsTotal", items == null ? 0 : items.size()); // 下限估计
        preview.put("items", items == null ? Collections.emptyList() : items);
        preview.put("note", "dry-run 预览，未创建任务，未消耗使用次数");
        return preview;
    }

    // ── pause / resume / stop ────────────────────────────────────

    public int pause(String runId) {
        int affected = runMapper.pause(runId);
        if (affected == 0) throw new IllegalStateException("暂停失败：run " + runId + " 当前状态非 RUNNING");
        return affected;
    }

    public int resume(String runId) {
        int affected = runMapper.resume(runId);
        if (affected == 0) throw new IllegalStateException("恢复失败：run " + runId + " 当前状态非 PAUSED");
        startAutoConsume(runId);
        return affected;
    }

    @Transactional
    public int stop(String runId) {
        int affected = runMapper.stop(runId);
        if (affected == 0) throw new IllegalStateException("停止失败：run " + runId + " 当前状态不允许停止");
        releasePendingItemsAfterStop(runId);
        return affected;
    }

    // ── consume ──────────────────────────────────────────────────

    /**
     * Starts the background worker for a queued/running request-center task.
     * Normal task creation calls this automatically after transaction commit.
     */
    public Map<String, Object> startAutoConsume(String runId) {
        SellerspriteRequestRun run = getRun(runId);
        if (!RUNNABLE_STATUS.contains(run.getStatus())) {
            return Map.of(
                    "runId", runId,
                    "started", false,
                    "status", run.getStatus(),
                    "message", "Only PENDING/RUNNING tasks can be auto-consumed");
        }
        if (!activeAutoRuns.add(runId)) {
            return Map.of(
                    "runId", runId,
                    "started", false,
                    "status", run.getStatus(),
                    "message", "Auto worker is already active");
        }
        sellerspriteRequestExecutor.execute(() -> {
            try {
                autoConsumeLoop(runId);
            } catch (Exception e) {
                log.error("Request center auto worker failed: runId={}, error={}", runId, e.getMessage(), e);
            } finally {
                activeAutoRuns.remove(runId);
            }
        });
        log.info("Request center auto worker started: runId={}, status={}", runId, run.getStatus());
        return Map.of(
                "runId", runId,
                "started", true,
                "status", run.getStatus(),
                "message", "Auto worker started");
    }

    @EventListener(ApplicationReadyEvent.class)
    public void recoverAutoConsumeTasks() {
        List<String> runIds = runMapper.selectRunnableRunIds();
        if (runIds.isEmpty()) {
            return;
        }
        log.info("Recovering request center auto workers: count={}", runIds.size());
        for (String runId : runIds) {
            int reset = itemMapper.resetRunningToPending(runId);
            runMapper.recountItemCounters(runId);
            if (reset > 0) {
                log.warn("Reset stale RUNNING request items to PENDING on startup: runId={}, count={}", runId, reset);
            }
            startAutoConsume(runId);
        }
    }

    private void startAutoConsumeAfterCommit(String runId) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            startAutoConsume(runId);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                startAutoConsume(runId);
            }
        });
    }

    private void autoConsumeLoop(String runId) {
        while (true) {
            SellerspriteRequestRun run = runMapper.selectById(runId);
            if (run == null) {
                log.warn("Request center auto worker stopped because run is missing: runId={}", runId);
                return;
            }
            if ("PAUSED".equals(run.getStatus()) || TERMINAL_STATUS.contains(run.getStatus())) {
                log.info("Request center auto worker stopped: runId={}, status={}", runId, run.getStatus());
                return;
            }
            Map<String, Object> result = consumeNext(runId, 1);
            SellerspriteRequestRun after = runMapper.selectById(runId);
            if (after == null) {
                return;
            }
            if ("PAUSED".equals(after.getStatus()) || TERMINAL_STATUS.contains(after.getStatus())) {
                log.info("Request center auto worker stopped after consume: runId={}, status={}", runId, after.getStatus());
                return;
            }
            int consumed = getInt(result, "consumed", 0);
            int pending = nvl(after.getPendingCount());
            if (consumed == 0) {
                if (pending <= 0) {
                    finalizeRun(runId);
                } else {
                    log.warn("Request center auto worker found pending_count but no PENDING item: runId={}, pending={}", runId, pending);
                }
                return;
            }
        }
    }

    public Map<String, Object> consumeNext(String runId, Integer batchSize) {
        SellerspriteRequestRun run = runMapper.selectById(runId);
        if (run == null) throw new IllegalArgumentException("任务不存在: " + runId);
        String status = run.getStatus();
        if ("PAUSED".equals(status) || "STOPPED".equals(status)) {
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("runId", runId);
            r.put("status", status);
            r.put("skipped", true);
            r.put("message", "任务当前状态 " + status + "，不消费");
            return r;
        }
        if ("SUCCESS".equals(status) || "FAILED".equals(status) || "PARTIAL_SUCCESS".equals(status)) {
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("runId", runId);
            r.put("status", status);
            r.put("finished", true);
            r.put("message", "任务已完结");
            return r;
        }
        // PENDING → RUNNING
        if ("PENDING".equals(status)) {
            runMapper.claimRunning(runId);
        }

        int batch = batchSize == null || batchSize < 1 ? DEFAULT_BATCH_SIZE : Math.min(batchSize, 50);
        List<SellerspriteRequestItem> pending = itemMapper.selectPending(runId, batch);
        if (pending.isEmpty()) {
            // 没有待处理子项——完结 run
            finalizeRun(runId);
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("runId", runId);
            r.put("consumed", 0);
            r.put("message", "无待处理子项，任务已完结");
            return r;
        }

        int success = 0, failed = 0, skipped = 0, consumed = 0, apiCallsTotal = 0;
        for (SellerspriteRequestItem item : pending) {
            // 再次检查 run 状态（可能被并发 stop）
            SellerspriteRequestRun fresh = runMapper.selectById(runId);
            if ("STOPPED".equals(fresh.getStatus()) || "PAUSED".equals(fresh.getStatus())) {
                log.info("任务 {} 被 {}，停止消费剩余子项", runId, fresh.getStatus());
                break;
            }
            int claimed = itemMapper.claimRunning(item.getId());
            if (claimed == 0) {
                // 已被其它消费者抢走或状态不允许，跳过
                skipped++;
                continue;
            }
            consumed++;
            try {
                Map<String, Object> syncResult = consumeSellerSpriteItem(run, item);
                int total = getInt(syncResult, "total", 0);
                int fetched = getInt(syncResult, "fetchedCount", getInt(syncResult, "fetched", 0));
                int written = getInt(syncResult, "writtenCount", getInt(syncResult, "inserted", 0));
                int apiCalls = getInt(syncResult, "apiCalls", 0);
                int itemFailed = Math.max(0, fetched - written);
                String itemStatus = itemFailed > 0 ? "PARTIAL_SUCCESS" : "SUCCESS";

                // 写回 item（事务外抓取，事务内写回）
                transactionTemplate.executeWithoutResult(s ->
                        markItemSuccess(item.getId(), runId, syncResult, total, fetched, written, itemFailed, apiCalls, itemStatus));
                success++;
                apiCallsTotal += apiCalls;
            } catch (RequestItemFailedException e) {
                Map<String, Object> failedResult = e.getResult();
                int apiCalls = getInt(failedResult, "apiCalls", 0);
                int total = getInt(failedResult, "total", 0);
                int fetched = getInt(failedResult, "fetchedCount", getInt(failedResult, "fetched", 0));
                int written = getInt(failedResult, "writtenCount", getInt(failedResult, "inserted", 0));
                int failedCount = getInt(failedResult, "failedCount", Math.max(0, fetched - written));
                String errMsg = truncate(String.valueOf(failedResult.getOrDefault("error", e.getMessage())), 512);
                String shopFetchRunId = failedResult.get("runId") == null ? null : String.valueOf(failedResult.get("runId"));
                transactionTemplate.executeWithoutResult(s ->
                        markItemFailed(item.getId(), runId, shopFetchRunId, errMsg, total, fetched, written, failedCount, apiCalls));
                failed++;
                apiCallsTotal += apiCalls;
                log.warn("请求中心子项失败: runId={}, sellerName={}, error={}, apiCalls={}",
                        runId, item.getSellerName(), errMsg, apiCalls);
            } catch (ShopProductSyncService.ShopProductSyncException e) {
                int apiCalls = e.getApiCalls();
                String errMsg = truncate(e.getMessage(), 512);
                transactionTemplate.executeWithoutResult(s ->
                        markItemFailed(item.getId(), runId, null, errMsg, e.getTotal(), e.getFetchedCount(),
                                e.getWrittenCount(), e.getFailedCount(), apiCalls));
                failed++;
                apiCallsTotal += apiCalls;
                log.warn("请求中心子项失败: runId={}, sellerName={}, error={}, apiCalls={}",
                        runId, item.getSellerName(), errMsg, apiCalls);
            } catch (Exception e) {
                String errMsg = truncate(e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName(), 512);
                transactionTemplate.executeWithoutResult(s ->
                        markItemFailed(item.getId(), runId, null, errMsg, 0, 0, 0, 0, 0));
                failed++;
                log.warn("请求中心子项异常: runId={}, sellerName={}, error={}",
                        runId, item.getSellerName(), errMsg);
            }
        }

        // 累加 run 计数（事务内）
        if (consumed > 0) {
            final int fSuccess = success, fFailed = failed, fSkipped = skipped, fConsumed = consumed, fApiCalls = apiCallsTotal;
            transactionTemplate.executeWithoutResult(s -> {
                itemMapper.applyItemResult(runId, fSuccess, fFailed, fSkipped, fConsumed);
                if (fApiCalls > 0) runMapper.addApiCalls(runId, fApiCalls);
            });
        }

        // 检查是否完结
        finalizeRun(runId);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("runId", runId);
        result.put("consumed", consumed);
        result.put("success", success);
        result.put("failed", failed);
        result.put("skipped", skipped);
        result.put("apiCalls", apiCallsTotal);
        SellerspriteRequestRun finalRun = runMapper.selectById(runId);
        result.put("status", finalRun.getStatus());
        result.put("progress", Map.of(
                "total", finalRun.getTotalCount(),
                "pending", finalRun.getPendingCount(),
                "success", finalRun.getSuccessCount(),
                "failed", finalRun.getFailedCount(),
                "skipped", finalRun.getSkippedCount(),
                "apiCalls", finalRun.getApiCalls()));
        return result;
    }

    /**
     * 按任务类型分流真实卖家精灵请求。
     *
     * <p>候选池批量抓取不能直接调用 shop_products 同步服务，否则会绕过 candidate/watchlist/shop_fetch_run
     * 的状态收口。它必须走 ShopCandidateService，让“方法卡命中 → 候选池 → 请求中心 → 店铺全集”
     * 这条链路保持一致。</p>
     */
    private Map<String, Object> consumeSellerSpriteItem(SellerspriteRequestRun run, SellerspriteRequestItem item) {
        if ("CANDIDATE_BATCH".equals(run.getRequestType())
                || "CANDIDATE_CONFIRM".equals(run.getTriggerType())) {
            if (item.getTriggerId() == null) {
                throw new IllegalStateException("候选批量抓取 item 缺少 triggerId(candidateId)");
            }
            Map<String, Object> result = candidateService.fetchFromRequestCenter(
                    item.getTriggerId(), "CANDIDATE_BATCH", run.getBatchCode());
            String status = String.valueOf(result.getOrDefault("status", ""));
            if ("FAILED".equals(status) || "ERROR".equals(status)) {
                throw new RequestItemFailedException(result);
            }
            return result;
        }
        return productSyncService.syncBySellerName(
                item.getSellerName(), item.getMarketplace(), run.getFetchReason(),
                null, null, run.getBatchCode());
    }

    // ── list / detail ────────────────────────────────────────────

    public PageResult<SellerspriteRequestRun> listRuns(String requestType, String triggerType, String status,
                                                       String batchCode, Integer page, Integer size) {
        int p = Math.max(1, page == null ? 1 : page);
        int s = Math.max(1, Math.min(size == null ? 50 : size, 200));
        LambdaQueryWrapper<SellerspriteRequestRun> qw = new LambdaQueryWrapper<SellerspriteRequestRun>()
                .eq(StringUtils.hasText(requestType), SellerspriteRequestRun::getRequestType, requestType)
                .eq(StringUtils.hasText(triggerType), SellerspriteRequestRun::getTriggerType, triggerType)
                .eq(StringUtils.hasText(status), SellerspriteRequestRun::getStatus, status)
                .eq(StringUtils.hasText(batchCode), SellerspriteRequestRun::getBatchCode, batchCode)
                .orderByDesc(SellerspriteRequestRun::getCreatedAt);
        Page<SellerspriteRequestRun> mpPage = new Page<>(p, s);
        Page<SellerspriteRequestRun> result = runMapper.selectPage(mpPage, qw);
        return PageResult.of(result.getRecords(), result.getTotal(), (long) p, (long) s);
    }

    public SellerspriteRequestRun getRun(String runId) {
        SellerspriteRequestRun run = runMapper.selectById(runId);
        if (run == null) throw new IllegalArgumentException("任务不存在: " + runId);
        return run;
    }

    public List<SellerspriteRequestItem> listItems(String runId) {
        return itemMapper.selectList(new LambdaQueryWrapper<SellerspriteRequestItem>()
                .eq(SellerspriteRequestItem::getRunId, runId)
                .orderByAsc(SellerspriteRequestItem::getSeq));
    }

    /** 重试单条 FAILED item：置回 PENDING，run 重新打开为 RUNNING（若已完结）。 */
    @Transactional
    public int retryItem(Long itemId) {
        SellerspriteRequestItem item = itemMapper.selectById(itemId);
        if (item == null) throw new IllegalArgumentException("子项不存在: " + itemId);
        if (!"FAILED".equals(item.getStatus())) {
            throw new IllegalStateException("只有 FAILED 子项可重试，当前: " + item.getStatus());
        }
        int reset = itemMapper.resetFailedToPending(itemId);
        if (reset == 0) return 0;
        itemMapper.reopenForRetry(item.getRunId());
        startAutoConsumeAfterCommit(item.getRunId());
        log.info("请求中心子项重试: runId={}, itemId={}", item.getRunId(), itemId);
        return reset;
    }

    // ── internal helpers ─────────────────────────────────────────

    private void markItemSuccess(Long itemId, String runId, Map<String, Object> syncResult,
                                 int total, int fetched, int written, int failed, int apiCalls, String itemStatus) {
        SellerspriteRequestItem item = itemMapper.selectById(itemId);
        item.setStatus(itemStatus);
        item.setShopFetchRunId((String) syncResult.get("runId"));
        item.setTotal(total);
        item.setFetchedCount(fetched);
        item.setWrittenCount(written);
        item.setFailedCount(failed);
        item.setApiCalls(apiCalls);
        item.setFinishedAt(LocalDateTime.now());
        itemMapper.updateById(item);
        // 精品池复抓触发时回写 shop_premium_pool（triggerId=premiumId）
        applyPremiumRefreshResult(runId, item.getTriggerId(), true, (String) syncResult.get("runId"), null);
    }

    private void markItemFailed(Long itemId, String runId, String shopFetchRunId, String errMsg, int total, int fetched,
                                int written, int failed, int apiCalls) {
        SellerspriteRequestItem item = itemMapper.selectById(itemId);
        item.setStatus("FAILED");
        if (StringUtils.hasText(shopFetchRunId)) {
            item.setShopFetchRunId(shopFetchRunId);
        }
        item.setTotal(total);
        item.setFetchedCount(fetched);
        item.setWrittenCount(written);
        item.setFailedCount(failed);
        item.setApiCalls(apiCalls);
        item.setErrorMessage(errMsg);
        item.setFinishedAt(LocalDateTime.now());
        itemMapper.updateById(item);
        applyPremiumRefreshResult(runId, item.getTriggerId(), false, null, errMsg);
    }

    /** 精品池复抓（trigger_type=PREMIUM_REFRESH）的 item 完成后回写 shop_premium_pool。 */
    private void applyPremiumRefreshResult(String runId, Long triggerId, boolean success,
                                           String fetchRunId, String errMsg) {
        if (triggerId == null) return;
        SellerspriteRequestRun run = runMapper.selectById(runId);
        if (run == null || !"PREMIUM_REFRESH".equals(run.getTriggerType())) return;
        if (success) {
            String fetchDate = LocalDate.now().format(DATE_FMT);
            String nextFetchDate = computeNextFetchDate(triggerId);
            premiumMapper.markRefreshSuccess(triggerId, fetchRunId, fetchDate, nextFetchDate);
        } else {
            premiumMapper.markRefreshFailed(triggerId, errMsg);
        }
    }

    /** 按 premium.refreshFrequency 算下次建议抓取日期：WEEKLY +7天，MONTHLY +30天，MANUAL 不算。 */
    private String computeNextFetchDate(Long premiumId) {
        com.sjzm.product.modules.shoppremium.entity.ShopPremiumPool p = premiumMapper.selectById(premiumId);
        if (p == null) return null;
        String freq = p.getRefreshFrequency();
        if (!StringUtils.hasText(freq) || "MANUAL".equals(freq)) return null;
        int plusDays = "WEEKLY".equals(freq) ? 7 : 30;
        return LocalDate.now().plusDays(plusDays).format(DATE_FMT);
    }

    /** 全部子项消费完后，根据成功/失败比例置 run 终态。 */
    private void finalizeRun(String runId) {
        SellerspriteRequestRun run = runMapper.selectById(runId);
        if (run == null) return;
        String status = run.getStatus();
        if ("SUCCESS".equals(status) || "FAILED".equals(status) || "PARTIAL_SUCCESS".equals(status)
                || "STOPPED".equals(status)) {
            return;
        }
        if (run.getPendingCount() != null && run.getPendingCount() > 0) {
            return; // 还有待处理，不完结
        }
        // PAUSED 不强制完结（用户可能 resume）
        if ("PAUSED".equals(status)) return;

        int success = nvl(run.getSuccessCount());
        int failed = nvl(run.getFailedCount());
        boolean hasPartialItem = hasPartialItems(runId);
        String finalStatus;
        if (failed == 0 && !hasPartialItem) {
            finalStatus = "SUCCESS";
        } else if (success == 0 && !hasPartialItem) {
            finalStatus = "FAILED";
        } else {
            finalStatus = "PARTIAL_SUCCESS";
        }
        run.setStatus(finalStatus);
        run.setFinishedAt(LocalDateTime.now());
        runMapper.updateById(run);
        log.info("请求中心任务完结: runId={}, status={}, success={}, failed={}, apiCalls={}",
                runId, finalStatus, success, failed, run.getApiCalls());
    }

    private int getInt(Map<String, Object> map, String key, int def) {
        Object v = map.get(key);
        if (v == null) return def;
        if (v instanceof Number n) return n.intValue();
        try { return Integer.parseInt(v.toString()); } catch (Exception e) { return def; }
    }

    private int nvl(Integer v) { return v == null ? 0 : v; }

    private boolean hasPartialItems(String runId) {
        return itemMapper.selectList(new LambdaQueryWrapper<SellerspriteRequestItem>()
                        .eq(SellerspriteRequestItem::getRunId, runId)
                        .eq(SellerspriteRequestItem::getStatus, "PARTIAL_SUCCESS"))
                .stream().findAny().isPresent();
    }

    /**
     * 停止任务时，只释放还没开始的 PENDING item；正在抓取的 RUNNING item 让它自然完成并回写结果。
     */
    private void releasePendingItemsAfterStop(String runId) {
        List<SellerspriteRequestItem> pending = itemMapper.selectList(new LambdaQueryWrapper<SellerspriteRequestItem>()
                .eq(SellerspriteRequestItem::getRunId, runId)
                .eq(SellerspriteRequestItem::getStatus, "PENDING"));
        if (pending.isEmpty()) return;

        int skipped = 0;
        String message = "请求中心任务已停止，未发起本条抓取";
        for (SellerspriteRequestItem item : pending) {
            int marked = itemMapper.markPendingSkipped(item.getId(), message);
            if (marked > 0) {
                skipped++;
                applyPremiumRefreshStopped(runId, item.getTriggerId(), message);
            }
        }
        if (skipped > 0) {
            itemMapper.applyItemResult(runId, 0, 0, skipped, skipped);
        }
    }

    /** PREMIUM_REFRESH 停止时释放精品池复抓锁，避免未消费店铺永久 RUNNING。 */
    private void applyPremiumRefreshStopped(String runId, Long triggerId, String message) {
        if (triggerId == null) return;
        SellerspriteRequestRun run = runMapper.selectById(runId);
        if (run == null || !"PREMIUM_REFRESH".equals(run.getTriggerType())) return;
        premiumMapper.markRefreshStopped(triggerId, message);
    }

    private String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() > max ? s.substring(0, max) : s;
    }

    private static class RequestItemFailedException extends RuntimeException {
        private final Map<String, Object> result;

        RequestItemFailedException(Map<String, Object> result) {
            super(String.valueOf(result.getOrDefault("error", "请求中心子项失败")));
            this.result = result;
        }

        Map<String, Object> getResult() {
            return result;
        }
    }

    /**
     * 任务级 marketplace 只是请求中心汇总维度；真正发给卖家精灵的站点以 item.marketplace 为准。
     * 多站点任务写 MIXED，避免 run 表 NOT NULL 失败，也避免把 MIXED 当成 API marketplace 使用。
     */
    private String resolveTaskMarketplace(String marketplace, List<RequestItemInput> items) {
        if (StringUtils.hasText(marketplace)) {
            return marketplace.trim().toUpperCase(Locale.ROOT);
        }
        Set<String> marketplaces = new LinkedHashSet<>();
        for (RequestItemInput item : items) {
            if (StringUtils.hasText(item.marketplace())) {
                marketplaces.add(item.marketplace().trim().toUpperCase(Locale.ROOT));
            }
        }
        if (marketplaces.size() == 1) {
            return marketplaces.iterator().next();
        }
        return "MIXED";
    }

    /** 子项输入（创建任务时传入）。 */
    public record RequestItemInput(String marketplace, String sellerName, Long triggerId) {}
}
