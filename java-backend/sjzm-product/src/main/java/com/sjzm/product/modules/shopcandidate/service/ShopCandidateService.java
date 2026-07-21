package com.sjzm.product.modules.shopcandidate.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.sjzm.common.PageResult;
import com.sjzm.product.config.DatabaseWorkloadGate;
import com.sjzm.product.modules.shopcandidate.entity.ShopCandidatePool;
import com.sjzm.product.modules.shopcandidate.entity.ShopFetchRun;
import com.sjzm.product.modules.shopcandidate.mapper.ShopCandidatePoolMapper;
import com.sjzm.product.modules.shopcandidate.mapper.ShopFetchRunMapper;
import com.sjzm.product.modules.shopcollection.entity.ShopWatchlist;
import com.sjzm.product.modules.shopcollection.mapper.ShopWatchlistMapper;
import com.sjzm.product.modules.shopcollection.service.ShopProductSyncService;
import com.sjzm.product.modules.shoprating.dto.ShopMethodBatchOption;
import com.sjzm.product.modules.shoprating.dto.ShopMethodRankItem;
import com.sjzm.product.modules.shoprating.service.ShopMethodRankService;
import com.sjzm.product.util.WeekTagUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * 店铺候选池——方法卡命中 → 候选池 → 人工确认 → 抓全集 → 观察池/精品池。
 *
 * <p>核心流程：{@link #syncFromMethodRank} 从方法卡排名批量写入候选池；
 * {@link #confirmFetch} 原子抢锁 → 创建 watchlist → 创建 shop_fetch_run
 * → 调店铺全集抓取 → 写回结果到各表。</p>
 *
 * <p>职责边界（硬约束）：
 * <ul>
 *   <li>方法卡命中只落候选池（PENDING），不直接写观察池。</li>
 *   <li>只有候选池确认（SELECTED → FETCHING → FETCHED）后才进观察池（source_type=CANDIDATE_CONFIRM）。</li>
 *   <li>每次抓取必须落 shop_fetch_run，成功失败都记录。</li>
 * </ul></p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ShopCandidateService {

    private final ShopCandidatePoolMapper candidateMapper;
    private final ShopFetchRunMapper fetchRunMapper;
    private final ShopMethodRankService methodRankService;
    private final ShopProductSyncService productSyncService;
    private final ShopWatchlistMapper watchlistMapper;
    private final WeekTagUtil weekTagUtil;
    private final TransactionTemplate transactionTemplate;
    private final DatabaseWorkloadGate workloadGate;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final int UPSERT_BATCH_SIZE = 500;
    private static final Set<String> VALID_STATUSES = Set.of(
            "PENDING", "SELECTED", "FETCHING", "FETCHED", "FETCH_FAILED", "IGNORED", "PROMOTED");
    private record FetchPreparation(ShopCandidatePool candidate, ShopWatchlist watchlist, ShopFetchRun run) {}

    // ── sync from method rank ────────────────────────────────────

    /**
     * 方法卡找店来源批次。返回的是方法卡读数源头，而不是候选池已有批次。
     */
    public List<ShopMethodBatchOption> listMethodBatches(String methodId, String marketplace, Integer limit) {
        return methodRankService.listMethodBatches(methodId, marketplace, limit);
    }

    /** 全量找店可用批次，不要求商品通过方法卡。 */
    public List<ShopMethodBatchOption> listAllSourceBatches(String marketplace, Integer limit) {
        return workloadGate.runHeavyQuery(() -> methodRankService.listAllSourceBatches(marketplace, limit));
    }

    /**
     * 从方法卡店铺排名同步候选池（替代旧 ShopWatchlistService.syncFromMethodRank 直写观察池）。
     *
     * @param methodId    方法卡（当前仅支持 M01）
     * @param marketplace 站点，null=全站点
     * @param minCount    命中数下限
     * @param batchCode   ISO 周批次，null=当前周
     * @return 同步结果
     */
    public Map<String, Object> syncFromMethodRank(String methodId, String marketplace,
                                                   Integer minCount, String batchCode, Integer limit) {
        String method = normalizeMethodId(methodId);
        int min = minCount == null || minCount < 1 ? 1 : minCount;
        String batch = StringUtils.hasText(batchCode) ? batchCode.trim() : weekTagUtil.currentWeekTag();
        int lim = limit == null || limit < 1 ? 1000 : Math.min(limit, 5000);
        return workloadGate.runHeavyWrite(() -> doSyncFromMethodRank(method, marketplace, min, batch, lim));
    }

    private Map<String, Object> doSyncFromMethodRank(String method, String marketplace,
                                                     int min, String batch, int lim) {
        String batchDate = LocalDate.now().format(DATE_FMT);

        List<ShopMethodRankItem> ranking = workloadGate.runHeavyQuery(
                () -> methodRankService.rankByMethod(method, marketplace, batch, min, lim));

        List<ShopCandidatePool> candidates = new ArrayList<>(ranking.size());
        for (ShopMethodRankItem item : ranking) {
            if (isInvalidSellerName(item.getSellerName())) continue;
            ShopCandidatePool entity = new ShopCandidatePool();
            entity.setMarketplace(item.getMarketplace());
            entity.setSellerName(item.getSellerName().trim());
            entity.setSourceType("METHOD_CARD");
            entity.setSourceCode(method);
            entity.setBatchCode(batch);
            entity.setBatchDate(batchDate);
            entity.setHitCount(item.getHitCount());
            entity.setTopCategory(item.getTopCategory());
            entity.setReason(buildReason(method, item));
            entity.setStatus("PENDING");
            candidates.add(entity);
        }
        int upserted = upsertCandidatesInBatches(candidates);

        log.info("候选池同步完成: methodId={}, marketplace={}, batchCode={}, ranked={}, upserted={}",
                method, marketplace, batch, ranking.size(), upserted);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("methodId", method);
        result.put("marketplace", marketplace);
        result.put("batchCode", batch);
        result.put("minCount", min);
        result.put("limit", lim);
        result.put("rankedShops", ranking.size());
        result.put("upserted", upserted);
        return result;
    }

    /**
     * 将指定来源周批次的全部店铺同步到候选池，不判断方法卡是否通过。
     */
    public Map<String, Object> syncAllFromBatch(String marketplace, String batchCode) {
        if (!StringUtils.hasText(batchCode)) {
            throw new IllegalArgumentException("请选择来源周批次");
        }
        return workloadGate.runHeavyWrite(() -> doSyncAllFromBatch(marketplace, batchCode));
    }

    private Map<String, Object> doSyncAllFromBatch(String marketplace, String batchCode) {
        String batch = batchCode.trim();
        String batchDate = LocalDate.now().format(DATE_FMT);
        List<ShopMethodRankItem> ranking = workloadGate.runHeavyQuery(
                () -> methodRankService.rankAllByBatch(marketplace, batch));

        List<ShopCandidatePool> candidates = new ArrayList<>(ranking.size());
        for (ShopMethodRankItem item : ranking) {
            if (isInvalidSellerName(item.getSellerName())) continue;
            ShopCandidatePool entity = new ShopCandidatePool();
            entity.setMarketplace(item.getMarketplace());
            entity.setSellerName(item.getSellerName().trim());
            entity.setSourceType("BATCH_ALL");
            entity.setSourceCode("ALL_PRODUCTS");
            entity.setBatchCode(batch);
            entity.setBatchDate(batchDate);
            entity.setHitCount(item.getHitCount());
            entity.setTopCategory(item.getTopCategory());
            entity.setReason(buildAllBatchReason(item));
            entity.setStatus("PENDING");
            candidates.add(entity);
        }
        int upserted = upsertCandidatesInBatches(candidates);

        log.info("批次全部店铺同步完成: marketplace={}, batchCode={}, ranked={}, upserted={}",
                marketplace, batch, ranking.size(), upserted);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("methodId", "ALL");
        result.put("marketplace", marketplace);
        result.put("batchCode", batch);
        result.put("minCount", 0);
        result.put("limit", ranking.size());
        result.put("rankedShops", ranking.size());
        result.put("upserted", upserted);
        return result;
    }

    // ── list / detail ────────────────────────────────────────────

    /** 候选池分页查询。 */
    public PageResult<ShopCandidatePool> list(String marketplace, String batchCode, String sourceType,
                                              String sourceCode, String status, Integer minHitCount,
                                              String sellerName, String requestState, Integer page, Integer size) {
        return workloadGate.runHeavyQuery(() -> {
            int p = Math.max(1, page == null ? 1 : page);
            int s = Math.max(1, Math.min(size == null ? 50 : size, 200));
            String normalizedRequestState = normalizeRequestState(requestState);
            String normalizedStatus = StringUtils.hasText(status) ? status.trim().toUpperCase(Locale.ROOT) : null;
            long total = candidateMapper.countByRequestState(marketplace, batchCode, sourceType, sourceCode,
                    normalizedStatus, minHitCount, sellerName, normalizedRequestState);
            List<ShopCandidatePool> records = total == 0 ? List.of() : candidateMapper.selectByRequestState(
                    marketplace, batchCode, sourceType, sourceCode, normalizedStatus, minHitCount, sellerName,
                    normalizedRequestState, (p - 1) * s, s);
            return PageResult.of(records, total, (long) p, (long) s);
        });
    }

    /**
     * 按当前筛选条件返回全部可抓候选，用于前端跨分页全选。
     *
     * <p>只返回 PENDING / SELECTED / FETCH_FAILED，避免把已抓取、抓取中、已忽略、
     * 已入精品池的店铺误选进请求中心任务。</p>
     */
    public List<ShopCandidatePool> listFetchable(String marketplace, String batchCode, String sourceType,
                                                 String sourceCode, String status, Integer minHitCount,
                                                 String sellerName, String requestState, Integer limit) {
        int lim = limit == null || limit < 1 ? 5000 : Math.min(limit, 10000);
        List<String> fetchableStatuses = List.of("PENDING", "SELECTED", "FETCH_FAILED");
        if (StringUtils.hasText(status) && !fetchableStatuses.contains(status.trim().toUpperCase(Locale.ROOT))) {
            return List.of();
        }
        return workloadGate.runHeavyQuery(() -> candidateMapper.selectFetchableByRequestState(
                marketplace, batchCode, sourceType, sourceCode,
                StringUtils.hasText(status) ? status.trim().toUpperCase(Locale.ROOT) : null,
                minHitCount, sellerName, normalizeRequestState(requestState), lim));
    }

    public ShopCandidatePool getById(Long id) {
        ShopCandidatePool entity = candidateMapper.selectById(id);
        if (entity == null) throw new IllegalArgumentException("候选记录不存在: " + id);
        return entity;
    }

    // ── status ───────────────────────────────────────────────────

    /** 状态流转（带过渡条件校验）。仅允许合法状态值且不跳级。 */
    public int updateStatus(Long id, String status) {
        String s = normalizeStatus(status);
        ShopCandidatePool entity = candidateMapper.selectById(id);
        if (entity == null) throw new IllegalArgumentException("候选记录不存在: " + id);
        String current = entity.getStatus();
        if (!isManualTransitionAllowed(current, s)) {
            throw new IllegalArgumentException("候选状态不允许从 " + current + " 手动流转到 " + s);
        }
        entity.setStatus(s);
        entity.setUpdatedAt(LocalDateTime.now());
        return candidateMapper.updateById(entity);
    }

    // ── confirm fetch (single) ───────────────────────────────────

    /**
     * 确认抓取——单店。
     *
     * <ol>
     *   <li>原子抢锁：PENDING/SELECTED/FETCH_FAILED → FETCHING</li>
     *   <li>创建/更新 shop_watchlist (source_type=CANDIDATE_CONFIRM)</li>
     *   <li>创建 shop_fetch_run (RUNNING)</li>
     *   <li>调用 ShopProductSyncService.syncBySellerName</li>
     *   <li>成功：fetch_run=SUCCESS, candidate=FETCHED, watchlist=FETCHED</li>
     *   <li>失败：fetch_run=FAILED, candidate=FETCH_FAILED, 记录 last_error_message</li>
     * </ol>
     */
    @Deprecated(forRemoval = true)
    public Map<String, Object> confirmFetch(Long candidateId) {
        rejectLegacyDirectExecution("候选店铺同步确认抓取");
        FetchPreparation preparation = transactionTemplate.execute(status ->
                prepareFetch(candidateId, "CANDIDATE_CONFIRM", null));
        if (preparation == null) {
            throw new IllegalStateException("创建抓取任务失败: " + candidateId);
        }
        return executePreparedFetch(candidateId, preparation);
    }

    /**
     * 请求中心消费候选批量抓取 item 时调用。
     *
     * <p>这里复用候选池同一套收口：原子抢锁、创建观察池、创建 shop_fetch_run、
     * 抓取 shop_products、回写候选/观察池/抓取记录。这样候选池大批量抓取也能
     * 进入请求中心看实况，同时不会绕过候选池状态机。</p>
     */
    public Map<String, Object> fetchFromRequestCenter(Long candidateId, String triggerType, String batchCode) {
        FetchPreparation preparation = transactionTemplate.execute(status ->
                prepareFetch(candidateId, triggerType, batchCode));
        if (preparation == null) {
            throw new IllegalStateException("创建请求中心候选抓取任务失败: " + candidateId);
        }
        return executePreparedFetch(candidateId, preparation);
    }

    private Map<String, Object> executePreparedFetch(Long candidateId, FetchPreparation preparation) {
        ShopCandidatePool candidate = preparation.candidate();
        ShopWatchlist watchlist = preparation.watchlist();
        ShopFetchRun run = preparation.run();
        String marketplace = candidate.getMarketplace();
        String sellerName = candidate.getSellerName();
        String runId = run.getRunId();
        String batchCode = run.getBatchCode();

        // 4. 抓取全集
        Map<String, Object> syncResult;
        try {
            syncResult = productSyncService.syncBySellerName(
                    sellerName, marketplace, candidate.getReason(), watchlist.getId(), runId, batchCode);
        } catch (Exception e) {
            log.error("店铺全集抓取失败: candidateId={}, sellerName={}, error={}", candidateId, sellerName, e.getMessage(), e);
            String errMsg = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
            int apiCalls = 0;
            int total = 0;
            int fetched = 0;
            int written = 0;
            int failed = 0;
            if (e instanceof ShopProductSyncService.ShopProductSyncException syncException) {
                apiCalls = syncException.getApiCalls();
                total = syncException.getTotal();
                fetched = syncException.getFetchedCount();
                written = syncException.getWrittenCount();
                failed = syncException.getFailedCount();
            }
            int finalTotal = total;
            int finalFetched = fetched;
            int finalWritten = written;
            int finalFailed = failed;
            int finalApiCalls = apiCalls;
            transactionTemplate.executeWithoutResult(status ->
                    markFetchFailed(candidateId, watchlist.getId(), runId, errMsg,
                            finalTotal, finalFetched, finalWritten, finalFailed, finalApiCalls));

            Map<String, Object> errorResult = new LinkedHashMap<>();
            errorResult.put("candidateId", candidateId);
            errorResult.put("runId", runId);
            errorResult.put("status", "FAILED");
            errorResult.put("error", errMsg);
            errorResult.put("apiCalls", apiCalls);
            errorResult.put("fetchedCount", fetched);
            errorResult.put("writtenCount", written);
            errorResult.put("failedCount", failed);
            return errorResult;
        }

        int total = getInt(syncResult, "total", 0);
        int fetched = getInt(syncResult, "fetchedCount", getInt(syncResult, "fetched", 0));
        int written = getInt(syncResult, "writtenCount", getInt(syncResult, "inserted", 0));
        int failed = getInt(syncResult, "failedCount", Math.max(0, fetched - written));
        int apiCalls = getInt(syncResult, "apiCalls", 0);
        boolean truncated = Boolean.TRUE.equals(syncResult.get("truncated"));
        String runStatus = failed > 0 || truncated ? "PARTIAL_SUCCESS" : "SUCCESS";
        transactionTemplate.executeWithoutResult(status ->
                markFetchSuccess(candidateId, watchlist.getId(), runId, total, fetched, written, failed, apiCalls, runStatus));

        log.info("店铺候选确认抓取完成: candidateId={}, sellerName={}, runId={}, total={}, fetched={}",
                candidateId, sellerName, runId, total, fetched);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("candidateId", candidateId);
        result.put("runId", runId);
        result.put("watchlistId", watchlist.getId());
        result.put("sellerName", sellerName);
        result.put("marketplace", marketplace);
        result.put("total", total);
        result.put("fetchedCount", fetched);
        result.put("writtenCount", written);
        result.put("failedCount", failed);
        result.put("apiCalls", apiCalls);
        result.put("truncated", truncated);
        result.put("truncationReason", syncResult.get("truncationReason"));
        result.put("remainingCount", getInt(syncResult, "remainingCount", 0));
        result.put("status", runStatus);
        return result;
    }

    // ── batch confirm ────────────────────────────────────────────

    /**
     * 批量确认抓取（阶段 1 同步小批验证入口）。
     *
     * <p>该方法逐条原子抢锁 + 抓取；单店失败不阻塞其它。
     * 每次真实卖家精灵 HTTP 请求仍由 {@link ShopProductSyncService} 统一按 2 秒限速。
     * 但它是同步接口，不提供暂停、停止和队列实况。几百/上千店铺的大批量抓取
     * 必须进入卖家精灵请求中心异步 worker。</p>
     *
     * @return 每条候选的抓取结果列表
     */
    @Deprecated(forRemoval = true)
    public List<Map<String, Object>> batchConfirmFetch(List<Long> candidateIds) {
        rejectLegacyDirectExecution("候选店铺同步批量抓取");
        List<Map<String, Object>> results = new ArrayList<>();
        for (Long id : candidateIds) {
            try {
                results.add(confirmFetch(id));
            } catch (Exception e) {
                Map<String, Object> err = new LinkedHashMap<>();
                err.put("candidateId", id);
                err.put("status", "ERROR");
                err.put("error", e.getMessage());
                results.add(err);
            }
        }
        return results;
    }

    // ── manual add ───────────────────────────────────────────────

    /** 人工加入候选池（source_type=MANUAL）。 */
    public ShopCandidatePool addManual(String marketplace, String sellerName, String reason, String note) {
        if (!StringUtils.hasText(marketplace) || !StringUtils.hasText(sellerName)) {
            throw new IllegalArgumentException("marketplace 和 sellerName 不能为空");
        }
        ShopCandidatePool entity = new ShopCandidatePool();
        entity.setMarketplace(marketplace.trim().toUpperCase(Locale.ROOT));
        entity.setSellerName(sellerName.trim());
        entity.setSourceType("MANUAL");
        entity.setSourceCode("");
        entity.setBatchCode(weekTagUtil.currentWeekTag());
        entity.setBatchDate(LocalDate.now().format(DATE_FMT));
        entity.setReason(StringUtils.hasText(reason) ? reason.trim() : "人工加入");
        entity.setNote(StringUtils.hasText(note) ? note.trim() : null);
        entity.setStatus("SELECTED");
        candidateMapper.upsert(entity);
        return entity;
    }

    // ── delete ───────────────────────────────────────────────────

    public int delete(Long id) {
        return candidateMapper.deleteById(id);
    }

    /** 旧同步抓取已下线，防止任何 Service 调用绕过卖家精灵请求中心。 */
    private void rejectLegacyDirectExecution(String operation) {
        throw new UnsupportedOperationException(operation + " 已迁移到卖家精灵请求中心，请创建 runId 后查看执行进度");
    }

    // ── fetch runs ───────────────────────────────────────────────

    /** 抓取运行记录分页查询。 */
    public PageResult<ShopFetchRun> fetchRuns(String marketplace, String sellerName, String triggerType,
                                              String batchCode, String status, Integer page, Integer size) {
        int p = Math.max(1, page == null ? 1 : page);
        int s = Math.max(1, Math.min(size == null ? 50 : size, 200));
        LambdaQueryWrapper<ShopFetchRun> qw = new LambdaQueryWrapper<ShopFetchRun>()
                .eq(StringUtils.hasText(marketplace), ShopFetchRun::getMarketplace, marketplace)
                .eq(StringUtils.hasText(sellerName), ShopFetchRun::getSellerName, sellerName)
                .eq(StringUtils.hasText(triggerType), ShopFetchRun::getTriggerType, triggerType)
                .eq(StringUtils.hasText(batchCode), ShopFetchRun::getBatchCode, batchCode)
                .eq(StringUtils.hasText(status), ShopFetchRun::getStatus, status)
                .orderByDesc(ShopFetchRun::getStartedAt);

        Page<ShopFetchRun> mpPage = new Page<>(p, s);
        Page<ShopFetchRun> result = fetchRunMapper.selectPage(mpPage, qw);
        return PageResult.of(result.getRecords(), result.getTotal(), (long) p, (long) s);
    }

    public ShopFetchRun getFetchRun(String runId) {
        ShopFetchRun run = fetchRunMapper.selectById(runId);
        if (run == null) throw new IllegalArgumentException("抓取记录不存在: " + runId);
        return run;
    }

    // ── internal helpers ─────────────────────────────────────────

    private FetchPreparation prepareFetch(Long candidateId, String triggerType, String batchCode) {
        ShopCandidatePool candidate = candidateMapper.selectById(candidateId);
        if (candidate == null) throw new IllegalArgumentException("候选记录不存在: " + candidateId);

        int locked = candidateMapper.atomicLockForFetch(candidateId);
        if (locked == 0) {
            throw new IllegalStateException("抢锁失败：候选记录 " + candidateId
                    + " 当前状态不允许抓取（仅 PENDING/SELECTED/FETCH_FAILED 可进入 FETCHING）");
        }
        candidate = candidateMapper.selectById(candidateId);
        ShopWatchlist watchlist = findOrCreateWatchlist(candidate);

        String runId = "FETCH_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        String effectiveTriggerType = normalizeFetchTriggerType(triggerType);
        String effectiveBatchCode = StringUtils.hasText(batchCode) ? batchCode.trim() : weekTagUtil.currentWeekTag();
        ShopFetchRun run = new ShopFetchRun();
        run.setRunId(runId);
        run.setMarketplace(candidate.getMarketplace());
        run.setSellerName(candidate.getSellerName());
        run.setTriggerType(effectiveTriggerType);
        run.setTriggerId(candidateId);
        run.setFetchReason(candidate.getReason());
        run.setBatchCode(effectiveBatchCode);
        run.setBatchDate(LocalDate.now().format(DATE_FMT));
        run.setVariationMode("Y");
        run.setStatus("RUNNING");
        run.setStartedAt(LocalDateTime.now());
        fetchRunMapper.insert(run);

        candidate.setFetchRunId(runId);
        candidate.setWatchlistId(watchlist.getId());
        candidateMapper.updateById(candidate);
        return new FetchPreparation(candidate, watchlist, run);
    }

    private String normalizeFetchTriggerType(String triggerType) {
        if (!StringUtils.hasText(triggerType)) return "CANDIDATE_CONFIRM";
        String t = triggerType.trim().toUpperCase(Locale.ROOT);
        if (!Set.of("CANDIDATE_CONFIRM", "CANDIDATE_BATCH").contains(t)) {
            return "CANDIDATE_BATCH";
        }
        return t;
    }

    private void markFetchSuccess(Long candidateId, Long watchlistId, String runId, int total, int fetched,
                                  int written, int failed, int apiCalls, String runStatus) {
        ShopFetchRun run = fetchRunMapper.selectById(runId);
        run.setStatus(runStatus);
        run.setTotal(total);
        run.setFetchedCount(fetched);
        run.setWrittenCount(written);
        run.setFailedCount(failed);
        run.setApiCalls(apiCalls);
        run.setErrorMessage(failed > 0 ? "部分商品解析或写入失败，详见后端日志" : null);
        run.setFinishedAt(LocalDateTime.now());
        fetchRunMapper.updateById(run);

        ShopCandidatePool candidate = candidateMapper.selectById(candidateId);
        candidate.setStatus("FETCHED");
        candidate.setFetchRunId(runId);
        candidate.setWatchlistId(watchlistId);
        candidate.setLastFetchAt(LocalDateTime.now());
        candidate.setLastErrorMessage(failed > 0 ? "部分商品解析或写入失败，详见抓取记录" : null);
        candidateMapper.updateById(candidate);

        ShopWatchlist watchlist = watchlistMapper.selectById(watchlistId);
        watchlist.setStatus("FETCHED");
        watchlist.setLastFetchRunId(runId);
        watchlistMapper.updateById(watchlist);
    }

    private void markFetchFailed(Long candidateId, Long watchlistId, String runId, String errMsg, int total,
                                 int fetched, int written, int failed, int apiCalls) {
        String error = truncate(errMsg, 512);
        ShopFetchRun run = fetchRunMapper.selectById(runId);
        run.setStatus("FAILED");
        run.setTotal(total);
        run.setFetchedCount(fetched);
        run.setWrittenCount(written);
        run.setFailedCount(failed);
        run.setApiCalls(apiCalls);
        run.setErrorMessage(error);
        run.setFinishedAt(LocalDateTime.now());
        fetchRunMapper.updateById(run);

        ShopCandidatePool candidate = candidateMapper.selectById(candidateId);
        candidate.setStatus("FETCH_FAILED");
        candidate.setFetchRunId(runId);
        candidate.setWatchlistId(watchlistId);
        candidate.setLastErrorMessage(error);
        candidate.setLastFetchAt(LocalDateTime.now());
        candidateMapper.updateById(candidate);
    }

    /** 为候选店铺创建或匹配观察池记录。 */
    private ShopWatchlist findOrCreateWatchlist(ShopCandidatePool candidate) {
        // 按 unique key (marketplace, seller_name, source_type, source_code) 查找
        LambdaQueryWrapper<ShopWatchlist> qw = new LambdaQueryWrapper<ShopWatchlist>()
                .eq(ShopWatchlist::getMarketplace, candidate.getMarketplace())
                .eq(ShopWatchlist::getSellerName, candidate.getSellerName())
                .eq(ShopWatchlist::getSourceType, "CANDIDATE_CONFIRM")
                .eq(ShopWatchlist::getSourceCode, candidate.getSourceCode() != null ? candidate.getSourceCode() : "");
        ShopWatchlist existing = watchlistMapper.selectOne(qw);
        if (existing != null) {
            existing.setHitCount(candidate.getHitCount());
            existing.setTopCategory(candidate.getTopCategory());
            existing.setReason(candidate.getReason());
            existing.setStatus("WATCHING");
            watchlistMapper.updateById(existing);
            return existing;
        }
        ShopWatchlist wl = new ShopWatchlist();
        wl.setMarketplace(candidate.getMarketplace());
        wl.setSellerName(candidate.getSellerName());
        wl.setSellerId(candidate.getSellerId());
        wl.setSourceType("CANDIDATE_CONFIRM");
        wl.setSourceCode(candidate.getSourceCode() != null ? candidate.getSourceCode() : "");
        wl.setReason(candidate.getReason());
        wl.setHitCount(candidate.getHitCount());
        wl.setTopCategory(candidate.getTopCategory());
        wl.setStatus("WATCHING");
        watchlistMapper.upsert(wl);
        // 重新查出来拿 id（AUTO_INCREMENT 的 ID 在 upsert 后 MySQL 不保证能取回）
        return watchlistMapper.selectOne(new LambdaQueryWrapper<ShopWatchlist>()
                .eq(ShopWatchlist::getMarketplace, candidate.getMarketplace())
                .eq(ShopWatchlist::getSellerName, candidate.getSellerName())
                .eq(ShopWatchlist::getSourceType, "CANDIDATE_CONFIRM")
                .eq(ShopWatchlist::getSourceCode, candidate.getSourceCode() != null ? candidate.getSourceCode() : ""));
    }

    private String buildReason(String methodId, ShopMethodRankItem item) {
        StringBuilder sb = new StringBuilder(methodId).append(" 命中 ").append(item.getHitCount()).append(" 个合格新品");
        if (StringUtils.hasText(item.getTopCategory())) {
            sb.append("，主打 ").append(item.getTopCategory());
        }
        return sb.toString();
    }

    private String buildAllBatchReason(ShopMethodRankItem item) {
        StringBuilder sb = new StringBuilder("批次全部店铺，收录 ")
                .append(item.getHitCount()).append(" 个商品");
        if (StringUtils.hasText(item.getTopCategory())) {
            sb.append("，主打 ").append(item.getTopCategory());
        }
        return sb.toString();
    }

    private int upsertCandidatesInBatches(List<ShopCandidatePool> candidates) {
        int processed = 0;
        for (int from = 0; from < candidates.size(); from += UPSERT_BATCH_SIZE) {
            int to = Math.min(from + UPSERT_BATCH_SIZE, candidates.size());
            candidateMapper.upsertBatch(new ArrayList<>(candidates.subList(from, to)));
            processed += to - from;
        }
        return processed;
    }

    private boolean isInvalidSellerName(String sellerName) {
        return !StringUtils.hasText(sellerName)
                || "amazon".equalsIgnoreCase(sellerName.trim())
                || "null".equalsIgnoreCase(sellerName.trim());
    }

    private String normalizeRequestState(String requestState) {
        if (!StringUtils.hasText(requestState)) return null;
        String normalized = requestState.trim().toUpperCase(Locale.ROOT);
        if (!Set.of("REQUESTED", "UNREQUESTED").contains(normalized)) {
            throw new IllegalArgumentException("请求状态仅支持 REQUESTED 或 UNREQUESTED");
        }
        return normalized;
    }

    private String normalizeMethodId(String methodId) {
        if (!StringUtils.hasText(methodId)) return "M01";
        return methodId.trim().toUpperCase(Locale.ROOT);
    }

    private String normalizeStatus(String status) {
        if (!StringUtils.hasText(status)) throw new IllegalArgumentException("status 不能为空");
        String s = status.trim().toUpperCase(Locale.ROOT);
        if (!VALID_STATUSES.contains(s)) {
            throw new IllegalArgumentException("status 仅支持: " + String.join(", ", VALID_STATUSES));
        }
        return s;
    }

    private boolean isManualTransitionAllowed(String current, String target) {
        if (Objects.equals(current, target)) return true;
        if ("FETCHING".equals(current)) return false;
        if ("FETCHING".equals(target) || "FETCH_FAILED".equals(target) || "FETCHED".equals(target)) return false;
        return switch (current) {
            case "PENDING" -> Set.of("SELECTED", "IGNORED").contains(target);
            case "SELECTED" -> Set.of("PENDING", "IGNORED").contains(target);
            case "FETCH_FAILED" -> Set.of("PENDING", "SELECTED", "IGNORED").contains(target);
            case "FETCHED" -> Set.of("PROMOTED", "IGNORED").contains(target);
            case "IGNORED" -> Set.of("PENDING", "SELECTED").contains(target);
            case "PROMOTED" -> Set.of("IGNORED").contains(target);
            default -> false;
        };
    }

    private int getInt(Map<String, Object> map, String key, int defaultValue) {
        Object value = map.get(key);
        if (value instanceof Number number) return number.intValue();
        if (value instanceof String text && StringUtils.hasText(text)) {
            try { return Integer.parseInt(text); } catch (NumberFormatException ignored) {}
        }
        return defaultValue;
    }

    private String truncate(String value, int maxLength) {
        if (value == null) return null;
        return value.length() > maxLength ? value.substring(0, maxLength) : value;
    }
}
