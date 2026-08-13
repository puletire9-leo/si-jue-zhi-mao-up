package com.sjzm.product.modules.requestcenter.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sjzm.common.PageResult;
import com.sjzm.product.dto.CompetitorLookupRequest;
import com.sjzm.product.entity.AsinImportResult;
import com.sjzm.product.entity.AsinImportTask;
import com.sjzm.product.entity.DengZongShopSeller;
import com.sjzm.product.entity.SkipAsin;
import com.sjzm.product.mapper.AsinImportResultMapper;
import com.sjzm.product.mapper.AsinImportTaskMapper;
import com.sjzm.product.modules.requestcenter.entity.SellerspriteRequestItem;
import com.sjzm.product.modules.requestcenter.entity.SellerspriteRequestRun;
import com.sjzm.product.modules.requestcenter.gateway.SellerspriteExecutionGateway;
import com.sjzm.product.modules.requestcenter.gateway.model.SellerspriteExecutionContext;
import com.sjzm.product.modules.requestcenter.gateway.model.SellerspriteExecutionException;
import com.sjzm.product.modules.requestcenter.gateway.model.SellerspriteExecutionRequest;
import com.sjzm.product.modules.requestcenter.model.SellerspriteExecutionErrorCode;
import com.sjzm.product.modules.requestcenter.model.SellerspriteSellerNamePolicy;
import com.sjzm.product.modules.requestcenter.mapper.SellerspriteRequestItemMapper;
import com.sjzm.product.modules.requestcenter.mapper.SellerspriteRequestRunMapper;
import com.sjzm.product.modules.shopcandidate.service.ShopCandidateService;
import com.sjzm.product.modules.shopcollection.service.ShopCollectionService;
import com.sjzm.product.modules.shopcollection.service.ShopProductSyncService;
import com.sjzm.product.service.CompetitorService;
import com.sjzm.product.service.DengZongShopService;
import com.sjzm.product.util.WeekTagUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executor;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Function;

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
    private final ShopCollectionService shopCollectionService;
    private final ShopCandidateService candidateService;
    private final WeekTagUtil weekTagUtil;
    private final TransactionTemplate transactionTemplate;
    @Qualifier("sellerspriteRequestExecutor")
    private final Executor sellerspriteRequestExecutor;
    private final com.sjzm.product.modules.shoppremium.mapper.ShopPremiumPoolMapper premiumMapper;
    private final AsinImportTaskMapper asinImportTaskMapper;
    private final AsinImportResultMapper asinImportResultMapper;
    private final CompetitorService competitorService;
    private final SellerspriteExecutionGateway executionGateway;
    private final DengZongShopService dengZongShopService;
    private final org.redisson.api.RedissonClient redissonClient;
    private final com.sjzm.product.service.ScoringService scoringService;
    private final com.sjzm.product.service.CleanLayerService cleanLayerService;
    private final com.sjzm.product.mapper.SkipAsinMapper skipAsinMapper;
    private final com.sjzm.product.service.BrsRankingService brsRankingService;

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    /** 创建任务幂等锁前缀：按 idempotencyKey 串行化"查活跃→插入"，堵住并发重复建任务窗口（跨实例）。 */
    private static final String CREATE_LOCK_PREFIX = "sellersprite:request-center:create-lock:";

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final int DEFAULT_BATCH_SIZE = 5;
    private static final int ASIN_BATCH_SIZE = 40;
    private static final int CLEAN_FINALIZATION_RETRY_SECONDS = 30;
    private static final String CLEAN_FINALIZATION_REASON_PREFIX = "新品清洗收尾失败: ";
    private static final Set<String> RUNNABLE_STATUS = Set.of("PENDING", "RUNNING");
    private static final Set<String> TERMINAL_STATUS = Set.of("SUCCESS", "FAILED", "PARTIAL_SUCCESS", "STOPPED");
    private final Set<String> activeAutoRuns = ConcurrentHashMap.newKeySet();
    /** consumeNext 的 per-run 互斥：同一 run 绝不允许两个线程同时消费，防止抢子项导致 skipped_count 虚高。 */
    private final Set<String> consumingRuns = ConcurrentHashMap.newKeySet();

    public SellerspriteRequestCenterService(SellerspriteRequestRunMapper runMapper,
                                             SellerspriteRequestItemMapper itemMapper,
                                             ShopProductSyncService productSyncService,
                                             ShopCollectionService shopCollectionService,
                                             ShopCandidateService candidateService,
                                             WeekTagUtil weekTagUtil,
                                             TransactionTemplate transactionTemplate,
                                             @Qualifier("sellerspriteRequestExecutor") Executor sellerspriteRequestExecutor,
                                             com.sjzm.product.modules.shoppremium.mapper.ShopPremiumPoolMapper premiumMapper,
                                             AsinImportTaskMapper asinImportTaskMapper,
                                             AsinImportResultMapper asinImportResultMapper,
                                             CompetitorService competitorService,
                                             SellerspriteExecutionGateway executionGateway,
                                             DengZongShopService dengZongShopService,
                                             org.redisson.api.RedissonClient redissonClient,
                                             com.sjzm.product.service.ScoringService scoringService,
                                             com.sjzm.product.service.CleanLayerService cleanLayerService,
                                             com.sjzm.product.mapper.SkipAsinMapper skipAsinMapper,
                                             com.sjzm.product.service.BrsRankingService brsRankingService) {
        this.runMapper = runMapper;
        this.itemMapper = itemMapper;
        this.productSyncService = productSyncService;
        this.shopCollectionService = shopCollectionService;
        this.candidateService = candidateService;
        this.weekTagUtil = weekTagUtil;
        this.transactionTemplate = transactionTemplate;
        this.sellerspriteRequestExecutor = sellerspriteRequestExecutor;
        this.premiumMapper = premiumMapper;
        this.asinImportTaskMapper = asinImportTaskMapper;
        this.asinImportResultMapper = asinImportResultMapper;
        this.competitorService = competitorService;
        this.executionGateway = executionGateway;
        this.dengZongShopService = dengZongShopService;
        this.redissonClient = redissonClient;
        this.scoringService = scoringService;
        this.cleanLayerService = cleanLayerService;
        this.skipAsinMapper = skipAsinMapper;
        this.brsRankingService = brsRankingService;
    }

    /**
     * 按幂等键串行执行"查活跃任务→无则新建"，堵住并发重复创建（重复扣费）窗口。
     * 关键：这些创建方法是 @Transactional，锁必须持有到事务提交之后才释放——否则第二个线程
     * 在第一个事务提交前拿到锁、查不到未提交的 run，仍会重复建。故在事务内注册 afterCompletion 释放，
     * 无事务时用 try-finally 立即释放。锁租约 30s、等待 20s；跨实例安全。
     */
    private <T> T withCreateLock(String idempotencyKey, java.util.function.Supplier<T> action) {
        org.redisson.api.RLock lock = redissonClient.getLock(CREATE_LOCK_PREFIX + idempotencyKey);
        boolean locked;
        try {
            locked = lock.tryLock(20L, 30L, java.util.concurrent.TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("等待创建任务幂等锁被中断: " + idempotencyKey, e);
        }
        if (!locked) {
            throw new IllegalStateException("获取创建任务幂等锁超时: " + idempotencyKey);
        }
        boolean deferredUnlock = false;
        try {
            T result = action.get();
            if (TransactionSynchronizationManager.isSynchronizationActive()) {
                // 事务提交后再释放锁，确保插入的 run 已可见，杜绝并发重复创建
                TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                    @Override
                    public void afterCompletion(int status) {
                        if (lock.isHeldByCurrentThread()) lock.unlock();
                    }
                });
                deferredUnlock = true;
            }
            return result;
        } finally {
            if (!deferredUnlock && lock.isHeldByCurrentThread()) lock.unlock();
        }
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
        if (Set.of("SHOP_FULL_LOOKUP", "CANDIDATE_BATCH", "PREMIUM_REFRESH")
                .contains(normalizeCode(requestType))) {
            throw new IllegalArgumentException(
                    "店铺任务禁止使用通用创建接口：普通候选请调用 /shop-tasks/once，精品复抓请调用 /shop-tasks/repeatable");
        }
        return createTaskInternal(requestType, marketplace, triggerType, triggerRef, fetchReason, items, operator);
    }

    /**
     * 普通候选店铺的一次性抓取入口。同站点同店铺跨 M1、批次全量及其他来源永久去重。
     */
    @Transactional
    public Map<String, Object> createShopTaskOnce(String marketplace, String triggerType,
                                                   String triggerRef, String fetchReason,
                                                   List<RequestItemInput> items, String operator) {
        return withCreateLock("SHOP_ONCE_GLOBAL", () -> {
            List<RequestItemInput> requested = normalizeShopItems(items);
            Set<String> unavailable = findShopKeys(requested, true);
            List<RequestItemInput> queued = requested.stream()
                    .filter(item -> !unavailable.contains(shopKey(item)))
                    .toList();
            if (queued.isEmpty()) {
                throw new IllegalArgumentException("所选店铺均已抓取或已有进行中的任务，无需重复请求卖家精灵");
            }
            // 按 item 是否带 triggerId(candidateId) 分流任务类型：
            //   全部带 → CANDIDATE_BATCH：候选池点选确认抓取，执行器按 candidateId 从候选池抓（原逻辑）
            //   存在不带 → SHOP_FULL_LOOKUP：手输店铺名（如店铺选品页「店铺请求」），
            //             执行器落默认分支 syncBySellerName 按店铺名抓全量写 shop_products。
            // CANDIDATE_BATCH 执行器强制要 triggerId，手输店铺无 candidateId 会必然失败——故必须分流。
            boolean allHaveTriggerId = queued.stream().allMatch(item -> item.triggerId() != null);
            String requestType = allHaveTriggerId ? "CANDIDATE_BATCH" : "SHOP_FULL_LOOKUP";
            SellerspriteRequestRun run = createTaskInternal(
                    requestType, marketplace, triggerType, triggerRef, fetchReason, queued, operator);
            return buildShopTaskResult(run, "ONCE", requested, queued, unavailable,
                    "同站点同店铺仅首次抓取；跨 M1、批次全量及其他普通来源不重复请求");
        });
    }

    /**
     * 精品店铺周期复抓入口。允许历史成功店铺再次抓取，但禁止与当前活跃任务并发重复。
     */
    @Transactional
    public Map<String, Object> createRepeatableShopTask(String marketplace, String triggerRef,
                                                         String fetchReason, List<RequestItemInput> items,
                                                         String operator) {
        return withCreateLock("SHOP_REPEATABLE_GLOBAL", () -> {
            List<RequestItemInput> requested = normalizeShopItems(items);
            validatePremiumRefreshItems(requested);
            Set<String> unavailable = findShopKeys(requested, false);
            List<RequestItemInput> queued = requested.stream()
                    .filter(item -> !unavailable.contains(shopKey(item)))
                    .toList();
            if (queued.isEmpty()) {
                throw new IllegalArgumentException("所选精品店铺已有进行中的复抓任务，请勿重复创建");
            }
            SellerspriteRequestRun run = createTaskInternal(
                    "PREMIUM_REFRESH", marketplace, "PREMIUM_REFRESH", triggerRef,
                    fetchReason, queued, operator);
            return buildShopTaskResult(run, "REPEATABLE", requested, queued, unavailable,
                    "仅精品店铺池使用；允许按周期再次抓取，但同一时间只允许一个活跃任务");
        });
    }

    /**
     * 非标店铺上新专用复抓入口。
     *
     * <p>名单只读取 {@code deng_zong_shop_seller}，任务类型固定为
     * {@code DENG_ZONG_SHOP_SYNC}，消费者固定写入 {@code deng_zong_shop}。
     * 历史终态任务不阻止再次抓取，但同站点同店铺存在活跃任务时跳过，
     * 绝不进入普通候选池或 {@code shop_products}。</p>
     */
    @Transactional
    public Map<String, Object> createDengZongShopTask(List<Long> sellerIds, String operator) {
        return withCreateLock("DENG_ZONG_REPEATABLE_GLOBAL", () -> {
            if (sellerIds == null || sellerIds.isEmpty()) {
                throw new IllegalArgumentException("至少选择一个非标店铺");
            }
            List<Long> distinctIds = sellerIds.stream().filter(Objects::nonNull).distinct().toList();
            List<DengZongShopSeller> sellers = dengZongShopService.sellerSelectList(
                    new LambdaQueryWrapper<DengZongShopSeller>().in(DengZongShopSeller::getId, distinctIds));
            if (sellers.size() != distinctIds.size()) {
                throw new IllegalArgumentException("部分非标店铺不存在或已被删除，请刷新名单后重试");
            }

            List<RequestItemInput> requested = normalizeShopItems(sellers.stream()
                    .map(seller -> new RequestItemInput(
                            seller.getMarketplace(), seller.getSellerName(), seller.getId()))
                    .toList());
            Set<String> unavailable = findShopKeys(requested, false);
            List<RequestItemInput> queued = requested.stream()
                    .filter(item -> !unavailable.contains(shopKey(item)))
                    .toList();
            if (queued.isEmpty()) {
                throw new IllegalArgumentException("所选非标店铺均有进行中的抓取任务，请勿并发重复创建");
            }

            SellerspriteRequestRun run = createTaskInternal(
                    "DENG_ZONG_SHOP_SYNC", null, "DENG_ZONG_REQUEST_CENTER", null,
                    "非标店铺上新重复抓取", queued, operator);
            return buildShopTaskResult(run, "DENG_ZONG_REPEATABLE", requested, queued, unavailable,
                    "仅写 deng_zong_shop；历史任务完成后允许复抓，活跃任务不并发重复");
        });
    }

    private void validatePremiumRefreshItems(List<RequestItemInput> items) {
        for (RequestItemInput item : items) {
            if (item.triggerId() == null) {
                throw new IllegalArgumentException("精品复抓子项必须携带精品店铺 premiumId");
            }
            var premium = premiumMapper.selectById(item.triggerId());
            if (premium == null || !"ACTIVE".equals(premium.getStatus())) {
                throw new IllegalArgumentException("可重复抓取接口仅允许 ACTIVE 精品店铺: premiumId=" + item.triggerId());
            }
            String expectedKey = premium.getMarketplace().trim().toUpperCase(Locale.ROOT) + "|"
                    + premium.getSellerName().trim().toLowerCase(Locale.ROOT);
            if (!expectedKey.equals(shopKey(item))) {
                throw new IllegalArgumentException("精品复抓店铺与 premiumId 不匹配: premiumId=" + item.triggerId());
            }
        }
    }

    private SellerspriteRequestRun createTaskInternal(String requestType, String marketplace, String triggerType,
                                                       String triggerRef, String fetchReason,
                                                       List<RequestItemInput> items, String operator) {
        if (items == null || items.isEmpty()) {
            throw new IllegalArgumentException("子项不能为空");
        }
        String effectiveMarketplace = resolveTaskMarketplace(marketplace, items);
        String idempotencyKey = buildIdempotencyKey(requestType, effectiveMarketplace, triggerType, triggerRef, items);
        return withCreateLock(idempotencyKey, () -> {
            SellerspriteRequestRun active = runMapper.selectActiveByIdempotencyKey(idempotencyKey);
            if (active != null) {
                log.info("复用活跃请求中心任务: runId={}, key={}", active.getRunId(), idempotencyKey);
                return active;
            }
            String runId = "REQ_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
            String batchCode = weekTagUtil.currentWeekTag();
            String batchDate = LocalDate.now().format(DATE_FMT);

            SellerspriteRequestRun run = new SellerspriteRequestRun();
            run.setRunId(runId);
            run.setRequestType(requestType);
            run.setMarketplace(effectiveMarketplace);
            run.setTriggerType(triggerType);
            run.setTriggerRef(triggerRef);
            run.setIdempotencyKey(idempotencyKey);
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
            List<SellerspriteRequestItem> requestItems = new ArrayList<>(items.size());
            for (RequestItemInput input : items) {
                SellerspriteRequestItem item = new SellerspriteRequestItem();
                item.setRunId(runId);
                item.setSeq(seq++);
                item.setMarketplace(StringUtils.hasText(input.marketplace()) ? input.marketplace() : marketplace);
                item.setSellerName(input.sellerName());
                item.setTriggerId(input.triggerId());
                item.setStatus("PENDING");
                requestItems.add(item);
            }
            for (int from = 0; from < requestItems.size(); from += 500) {
                int to = Math.min(from + 500, requestItems.size());
                itemMapper.insertBatch(new ArrayList<>(requestItems.subList(from, to)));
            }

            log.info("请求中心任务已创建: runId={}, requestType={}, marketplace={}, items={}",
                    runId, requestType, marketplace, items.size());
            startAutoConsumeAfterCommit(runId);
            return run;
        });
    }

    private List<RequestItemInput> normalizeShopItems(List<RequestItemInput> items) {
        if (items == null || items.isEmpty()) {
            throw new IllegalArgumentException("店铺子项不能为空");
        }
        Map<String, RequestItemInput> distinct = new LinkedHashMap<>();
        for (RequestItemInput item : items) {
            if (item == null || !StringUtils.hasText(item.marketplace()) || !StringUtils.hasText(item.sellerName())) {
                continue;
            }
            String mp = item.marketplace().trim().toUpperCase(Locale.ROOT);
            String seller = item.sellerName().trim();
            if (SellerspriteSellerNamePolicy.isBlocked(seller)) continue;
            RequestItemInput normalized = new RequestItemInput(mp, seller, item.triggerId());
            distinct.putIfAbsent(shopKey(normalized), normalized);
        }
        if (distinct.isEmpty()) {
            throw new IllegalArgumentException("没有有效店铺；店铺名和站点不能为空，Amazon 店铺禁止抓取");
        }
        return new ArrayList<>(distinct.values());
    }

    private Set<String> findShopKeys(List<RequestItemInput> items, boolean onceOnly) {
        List<String> keys = items.stream().map(this::shopKey).toList();
        Set<String> result = new HashSet<>();
        for (int from = 0; from < keys.size(); from += 200) {
            List<String> chunk = keys.subList(from, Math.min(from + 200, keys.size()));
            List<String> found = onceOnly
                    ? itemMapper.selectUnavailableOnceShopKeys(chunk)
                    : itemMapper.selectActiveShopKeys(chunk);
            if (found != null) result.addAll(found);
        }
        return result;
    }

    private String shopKey(RequestItemInput item) {
        return item.marketplace().trim().toUpperCase(Locale.ROOT) + "|"
                + item.sellerName().trim().toLowerCase(Locale.ROOT);
    }

    private Map<String, Object> buildShopTaskResult(SellerspriteRequestRun run, String mode,
                                                     List<RequestItemInput> requested,
                                                     List<RequestItemInput> queued,
                                                     Set<String> skippedKeys,
                                                     String policy) {
        List<String> skippedShops = requested.stream()
                .filter(item -> skippedKeys.contains(shopKey(item)))
                .map(item -> item.marketplace() + ":" + item.sellerName())
                .limit(100)
                .toList();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("runId", run.getRunId());
        result.put("status", run.getStatus());
        result.put("requestType", run.getRequestType());
        result.put("requestMode", mode);
        result.put("requestedCount", requested.size());
        result.put("queuedCount", queued.size());
        result.put("totalCount", queued.size());
        result.put("skippedCount", requested.size() - queued.size());
        result.put("skippedShops", skippedShops);
        result.put("repeatPolicy", policy);
        return result;
    }

    private String normalizeCode(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }

    /**
     * 从八爪鱼流式初筛任务的 PASS 结果创建请求中心 ASIN 批量查询任务。
     *
     * <p>读取指定初筛任务的 PASS ASIN 并去重，按 {@link #ASIN_BATCH_SIZE}（40）每批一个子项创建请求中心任务。
     * 子项以 {@code asin_list}（JSON 数组）存储 ASIN 批次载荷，并关联来源任务 ID。
     * 创建后自动进入后台消费。</p>
     *
     * @param taskId     初筛任务 ID（asin_import_tasks.id），必须为 READY 状态
     * @param operator   操作人，可空
     * @param fetchReason 抓取原因
     * @return 创建的 run
     * @throws IllegalArgumentException 任务不存在、非 READY 或 PASS ASIN 为空
     */
    @Transactional
    public SellerspriteRequestRun createTaskFromStreamingResult(Long taskId, String operator, String fetchReason) {
        AsinImportTask srcTask = asinImportTaskMapper.selectByIdForUpdate(taskId);
        if (srcTask == null) {
            throw new IllegalArgumentException("初筛任务不存在: " + taskId);
        }
        if (!"READY".equals(srcTask.getTaskStatus())) {
            throw new IllegalArgumentException("初筛任务状态必须为 READY，当前: " + srcTask.getTaskStatus());
        }

        // 同一来源任务在 PENDING/RUNNING/PAUSED 期间只允许一个请求中心运行任务，避免重复扣费。
        SellerspriteRequestRun activeRun = runMapper.selectActiveAsinRunBySourceTaskId(taskId);
        if (activeRun != null) {
            log.info("复用来源初筛任务的活跃请求中心任务: taskId={}, runId={}", taskId, activeRun.getRunId());
            return activeRun;
        }

        String dataMonth = resolveDataMonth(srcTask);
        if (!dataMonth.equals(srcTask.getDataMonth())) {
            srcTask.setDataMonth(dataMonth);
            asinImportTaskMapper.updateById(srcTask);
        }

        List<String> asins = asinImportResultMapper.selectAsinListByTaskAndStatus(taskId, "PASS");
        if (asins == null || asins.isEmpty()) {
            throw new IllegalArgumentException("初筛任务无 PASS ASIN: " + taskId);
        }

        boolean premiumTarget = "premium_products".equalsIgnoreCase(srcTask.getTargetTable())
                || Boolean.FALSE.equals(srcTask.getInitialFilter());

        // 内存去重（PASS 结果本身已去重，但防御性做一次）
        Set<String> deduped = asins.stream()
                .filter(StringUtils::hasText)
                .map(value -> value.trim().toUpperCase(Locale.ROOT))
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
        List<String> distinctAsins = new ArrayList<>(deduped);
        int sourceAsinCount = distinctAsins.size();
        int enrichedSkippedCount = 0;
        if (premiumTarget) {
            Set<String> enrichedAsins = competitorService.findEnrichedPremiumAsins(
                    srcTask.getMarketplace(), distinctAsins);
            if (!enrichedAsins.isEmpty()) {
                distinctAsins.removeIf(enrichedAsins::contains);
                enrichedSkippedCount = sourceAsinCount - distinctAsins.size();
            }
            if (distinctAsins.isEmpty()) {
                throw new IllegalArgumentException("该站点本任务的精品 ASIN 均已由卖家精灵补全，无需重复请求");
            }
        }
        int totalItems = (distinctAsins.size() + ASIN_BATCH_SIZE - 1) / ASIN_BATCH_SIZE;

        String runId = "REQ_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        String batchCode = weekTagUtil.currentWeekTag();
        String batchDate = LocalDate.now().format(DATE_FMT);

        String requestType = premiumTarget ? "PREMIUM_ASIN_LOOKUP" : "ASIN_BATCH_LOOKUP";

        // 在 triggerRef 中存储来源信息和结果落表配置
        Map<String, Object> triggerMeta = new LinkedHashMap<>();
        triggerMeta.put("sourceTaskId", taskId);
        triggerMeta.put("month", dataMonth);
        triggerMeta.put("mappingId", srcTask.getBazhuayuMappingId());
        triggerMeta.put("bazhuayuTaskId", srcTask.getBazhuayuTaskId());
        triggerMeta.put("taskName", srcTask.getTaskName());
        triggerMeta.put("taskCategory", srcTask.getTaskCategory());
        triggerMeta.put("initialFilter", srcTask.getInitialFilter());
        triggerMeta.put("targetTable", srcTask.getTargetTable());
        triggerMeta.put("weekTag", weekTagUtil.currentWeekTag());
        triggerMeta.put("sourceAsinCount", sourceAsinCount);
        triggerMeta.put("enrichedSkippedCount", enrichedSkippedCount);
        triggerMeta.put("requestAsinCount", distinctAsins.size());
        String triggerRefJson;
        try {
            triggerRefJson = OBJECT_MAPPER.writeValueAsString(triggerMeta);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("序列化 triggerRef 失败", e);
        }

        SellerspriteRequestRun run = new SellerspriteRequestRun();
        run.setRunId(runId);
        run.setRequestType(requestType);
        run.setMarketplace(srcTask.getMarketplace());
        run.setTriggerType("MANUAL");
        run.setTriggerRef(triggerRefJson);
        run.setSourceTaskId(taskId);
        run.setFetchReason(fetchReason != null ? fetchReason
                : (premiumTarget ? "八爪鱼精品任务人工确认请求" : "八爪鱼初筛 PASS 人工确认请求"));
        run.setBatchCode(batchCode);
        run.setBatchDate(batchDate);
        run.setTotalCount(totalItems);
        run.setPendingCount(totalItems);
        run.setRunningCount(0);
        run.setSuccessCount(0);
        run.setFailedCount(0);
        run.setSkippedCount(0);
        run.setApiCalls(0);
        run.setStatus("PENDING");
        run.setOperator(operator);
        runMapper.insert(run);

        for (int i = 0; i < totalItems; i++) {
            int from = i * ASIN_BATCH_SIZE;
            int to = Math.min(from + ASIN_BATCH_SIZE, distinctAsins.size());
            List<String> batch = distinctAsins.subList(from, to);

            String asinListJson;
            try {
                asinListJson = OBJECT_MAPPER.writeValueAsString(batch);
            } catch (JsonProcessingException e) {
                throw new RuntimeException("序列化 asin_list 失败", e);
            }

            SellerspriteRequestItem item = new SellerspriteRequestItem();
            item.setRunId(runId);
            item.setSeq(i);
            item.setMarketplace(srcTask.getMarketplace());
            item.setSourceTaskId(taskId);
            item.setAsinList(asinListJson);
            item.setStatus("PENDING");
            itemMapper.insert(item);
        }

        log.info("从八爪鱼导入任务创建请求中心任务: runId={}, taskId={}, requestType={}, sourceAsins={}, skippedEnriched={}, requestAsins={}, items={}",
                runId, taskId, requestType, sourceAsinCount, enrichedSkippedCount, distinctAsins.size(), totalItems);
        startAutoConsumeAfterCommit(runId);
        return run;
    }

    /** 创建手动 ASIN 查询任务；请求会按 40 个 ASIN 分批执行并完整进入请求中心。 */
    /**
     * 为初筛来源页提供最新 ASIN 批量运行摘要。
     * 来源任务仍保留 READY 等初筛状态，页面不得再把它误认为“尚未执行卖家精灵”。
     */
    public Map<Long, SellerspriteRequestRun> findLatestAsinRunsBySourceTaskIds(Collection<Long> sourceTaskIds) {
        if (sourceTaskIds == null || sourceTaskIds.isEmpty()) {
            return Map.of();
        }
        List<SellerspriteRequestRun> runs = runMapper.selectLatestAsinRunsBySourceTaskIds(
                sourceTaskIds.stream().filter(Objects::nonNull).distinct().toList());
        return runs.stream()
                .filter(run -> run.getSourceTaskId() != null)
                .collect(java.util.stream.Collectors.toMap(SellerspriteRequestRun::getSourceTaskId,
                        run -> run, (left, right) -> left, LinkedHashMap::new));
    }

    @Transactional
    public SellerspriteRequestRun createManualAsinTask(CompetitorLookupRequest request, String operator) {
        if (request.getAsins() == null || request.getAsins().isEmpty()) {
            throw new IllegalArgumentException("ASIN 列表不能为空");
        }
        List<String> asins = new ArrayList<>(new LinkedHashSet<>(request.getAsins()));
        String month = StringUtils.hasText(request.getMonth()) ? request.getMonth() : currentDataMonth();
        String idempotencyKey = buildManualAsinIdempotencyKey(request, asins, month);
        return withCreateLock(idempotencyKey, () -> {
            SellerspriteRequestRun active = runMapper.selectActiveByIdempotencyKey(idempotencyKey);
            if (active != null) {
                log.info("复用活跃手动 ASIN 请求中心任务: runId={}, key={}", active.getRunId(), idempotencyKey);
                return active;
            }
            String runId = "REQ_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
            int itemCount = (asins.size() + ASIN_BATCH_SIZE - 1) / ASIN_BATCH_SIZE;
            SellerspriteRequestRun run = new SellerspriteRequestRun();
            run.setRunId(runId);
            run.setRequestType("MANUAL_ASIN_LOOKUP");
            run.setMarketplace(request.getMarketplace());
            run.setTriggerType("MANUAL");
            run.setTriggerRef(writeMonthTriggerRef(month));
            run.setIdempotencyKey(idempotencyKey);
            run.setFetchReason("手动 ASIN 查询");
            run.setBatchCode(weekTagUtil.currentWeekTag());
            run.setBatchDate(LocalDate.now().format(DATE_FMT));
            run.setTotalCount(itemCount);
            run.setPendingCount(itemCount);
            run.setRunningCount(0); run.setSuccessCount(0); run.setFailedCount(0); run.setSkippedCount(0); run.setApiCalls(0);
            run.setStatus("PENDING");
            run.setOperator(operator);
            runMapper.insert(run);
            for (int i = 0; i < itemCount; i++) {
                List<String> batchAsins = asins.subList(i * ASIN_BATCH_SIZE,
                        Math.min((i + 1) * ASIN_BATCH_SIZE, asins.size()));
                SellerspriteRequestItem item = new SellerspriteRequestItem();
                item.setRunId(runId); item.setSeq(i); item.setMarketplace(request.getMarketplace());
                item.setAsinList(writeAsinList(batchAsins));
                item.setPayloadJson(writeLookupPayload(copyLookupRequest(request, batchAsins)));
                item.setStatus("PENDING");
                itemMapper.insert(item);
            }
            startAutoConsumeAfterCommit(runId);
            return run;
        });
    }

    /**
     * 创建 BRS 榜单 ASIN 批量任务（仿 createManualAsinTask），但请求类型 BRS_ASIN_LOOKUP，
     * 卖家精灵返回写入 brs_ranking_raw（隔离于竞品/新品榜）。
     * 批次元数据（batchDate/batchLabel/sourceRunId）存 run，被 consume 传给 brsRankingService。
     * @param batchLabel 批次名称，如 UK-kitchen-30页
     */
    public SellerspriteRequestRun createBrsAsinTask(CompetitorLookupRequest request, String batchLabel, String operator) {
        if (request.getAsins() == null || request.getAsins().isEmpty()) {
            throw new IllegalArgumentException("ASIN 列表不能为空");
        }
        List<String> asins = new ArrayList<>(new LinkedHashSet<>(request.getAsins()));
        String month = StringUtils.hasText(request.getMonth()) ? request.getMonth() : currentDataMonth();
        String idempotencyKey = buildManualAsinIdempotencyKey(request, asins, month) + "_BRS";
        return withCreateLock(idempotencyKey, () -> {
            SellerspriteRequestRun active = runMapper.selectActiveByIdempotencyKey(idempotencyKey);
            if (active != null) {
                log.info("复用活跃 BRS ASIN 任务: runId={}, key={}", active.getRunId(), idempotencyKey);
                return active;
            }
            String runId = "REQ_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
            int itemCount = (asins.size() + ASIN_BATCH_SIZE - 1) / ASIN_BATCH_SIZE;
            String batchDate = LocalDate.now().format(DATE_FMT);  // YYYYMMDD
            String triggerRef = writeBrsMetaForRun(month, batchLabel);
            SellerspriteRequestRun run = new SellerspriteRequestRun();
            run.setRunId(runId);
            run.setRequestType("BRS_ASIN_LOOKUP");
            run.setMarketplace(request.getMarketplace());
            run.setTriggerType("MANUAL");
            run.setTriggerRef(triggerRef);
            run.setIdempotencyKey(idempotencyKey);
            run.setFetchReason("BRS榜单 ASIN 补数");
            run.setBatchCode(weekTagUtil.currentWeekTag());
            run.setBatchDate(batchDate);
            run.setTotalCount(itemCount); run.setPendingCount(itemCount); run.setRunningCount(0);
            run.setSuccessCount(0); run.setFailedCount(0); run.setSkippedCount(0); run.setApiCalls(0);
            run.setStatus("PENDING");
            run.setOperator(operator);
            runMapper.insert(run);
            for (int i = 0; i < itemCount; i++) {
                List<String> batch = asins.subList(i * ASIN_BATCH_SIZE, Math.min((i + 1) * ASIN_BATCH_SIZE, asins.size()));
                SellerspriteRequestItem item = new SellerspriteRequestItem();
                item.setRunId(runId); item.setSeq(i); item.setMarketplace(request.getMarketplace());
                item.setAsinList(writeAsinList(batch));
                item.setPayloadJson(writeLookupPayload(copyLookupRequest(request, batch)));
                item.setStatus("PENDING");
                itemMapper.insert(item);
            }
            startAutoConsumeAfterCommit(runId);
            return run;
        });
    }

    /** 将卖家名预览任务转换为请求中心任务，普通目标写竞品库，邓总目标写 deng_zong_shop。 */
    @Transactional
    public SellerspriteRequestRun createSellerBatchTask(Long sourceTaskId, String target, String month, String operator) {
        AsinImportTask sourceTask = asinImportTaskMapper.selectById(sourceTaskId);
        if (sourceTask == null) throw new IllegalArgumentException("卖家名导入任务不存在: " + sourceTaskId);
        List<AsinImportResult> rows = asinImportResultMapper.selectList(new LambdaQueryWrapper<AsinImportResult>()
                .eq(AsinImportResult::getTaskId, sourceTaskId)
                .eq(AsinImportResult::getStatus, "PASS"));
        List<RequestItemInput> items = rows.stream()
                .map(AsinImportResult::getSellerName)
                .filter(StringUtils::hasText)
                .map(name -> new RequestItemInput(sourceTask.getMarketplace(), name, null))
                .distinct().toList();
        if (items.isEmpty()) throw new IllegalArgumentException("卖家名导入任务没有可执行店铺: " + sourceTaskId);
        String requestType = "deng_zong_shop".equalsIgnoreCase(target) ? "DENG_ZONG_SHOP_SYNC" : "SELLER_BATCH_LOOKUP";
        String resolvedMonth = StringUtils.hasText(month) ? month : currentDataMonth();
        String triggerRef;
        try {
            Map<String, Object> meta = new LinkedHashMap<>();
            meta.put("sourceTaskId", sourceTaskId);
            meta.put("month", resolvedMonth);
            triggerRef = OBJECT_MAPPER.writeValueAsString(meta);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("序列化 triggerRef 失败", e);
        }
        return createTask(requestType, sourceTask.getMarketplace(), "MANUAL", triggerRef,
                "卖家名批量导入", items, operator);
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
        if (affected == 0) throw new IllegalStateException("恢复失败：run " + runId + " 当前状态非 PAUSED 或 PAUSED_SYSTEM");
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

    /**
     * 删除终态任务及其子项。活跃任务必须先停止，且当前 worker 完全退出后才能删除，
     * 避免外部请求完成时回写一条已被删除的 run。
     */
    @Transactional
    public int delete(String runId) {
        SellerspriteRequestRun run = getRun(runId);
        if (!TERMINAL_STATUS.contains(run.getStatus())) {
            throw new IllegalStateException("删除失败：请先停止任务，当前状态为 " + run.getStatus());
        }
        if (activeAutoRuns.contains(runId) || consumingRuns.contains(runId)) {
            throw new IllegalStateException("删除失败：当前已发出的请求仍在收尾，请稍后重试");
        }

        itemMapper.delete(new LambdaQueryWrapper<SellerspriteRequestItem>()
                .eq(SellerspriteRequestItem::getRunId, runId));
        int affected = runMapper.deleteById(runId);
        if (affected == 0) {
            throw new IllegalStateException("删除失败：run " + runId + " 不存在或已被删除");
        }
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
            int waitingRetry = itemMapper.countWaitingRetry(runId);
            if (reset > 0) {
                log.warn("Recovered stale request items on startup: runId={}, count={}, waitingRetry={}",
                        runId, reset, waitingRetry);
            }
            if (waitingRetry > 0) {
                runMapper.pauseSystem(runId, "服务重启：存在已发出但结果未知的请求，等待人工确认", null);
                continue;
            }
            startAutoConsume(runId);
        }
    }

    /** 恢复确认未发出的瞬时故障以及 clean 收尾；结果未知请求必须保留给人工确认。 */
    @Scheduled(fixedDelayString = "${sellersprite.retry-recovery-delay-ms:10000}")
    public void recoverDueSafeRetries() {
        for (String runId : runMapper.selectDueSystemRetryRunIds()) {
            SellerspriteRequestRun run = runMapper.selectById(runId);
            if (isCleanFinalizationRetry(run)) {
                if (runMapper.resume(runId) > 0) {
                    startAutoConsume(runId);
                    log.info("恢复新品清洗层收尾重试: runId={}", runId);
                }
                continue;
            }
            int released = itemMapper.releaseDueSafeRetries(runId);
            if (released <= 0) continue;
            if (runMapper.resume(runId) > 0) {
                runMapper.recountItemCounters(runId);
                startAutoConsume(runId);
                log.info("恢复卖家精灵安全重试: runId={}, items={}", runId, released);
            }
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
            if ("PAUSED".equals(run.getStatus()) || "PAUSED_SYSTEM".equals(run.getStatus())
                    || TERMINAL_STATUS.contains(run.getStatus())) {
                log.info("Request center auto worker stopped: runId={}, status={}", runId, run.getStatus());
                return;
            }
            Map<String, Object> result = consumeNext(runId, 1);
            SellerspriteRequestRun after = runMapper.selectById(runId);
            if (after == null) {
                return;
            }
            if ("PAUSED".equals(after.getStatus()) || "PAUSED_SYSTEM".equals(after.getStatus())
                    || TERMINAL_STATUS.contains(after.getStatus())) {
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

    /**
     * 消费一批子项。per-run 互斥：同一 run 同时只允许一个线程进入消费循环，
     * 避免自动 worker 与手动 consume 端点并发抢子项，导致 skipped_count 虚高、计数漂移。
     * 卖家精灵实际调用另有全局单进程锁（{@code DefaultSellerspriteExecutionGateway}）保证串行。
     */
    public Map<String, Object> consumeNext(String runId, Integer batchSize) {
        if (!consumingRuns.add(runId)) {
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("runId", runId);
            r.put("consumed", 0);
            r.put("skipped", true);
            r.put("message", "该任务正在被另一消费者处理，跳过本次并发消费");
            return r;
        }
        try {
            return consumeNextGuarded(runId, batchSize);
        } finally {
            consumingRuns.remove(runId);
        }
    }

    private Map<String, Object> consumeNextGuarded(String runId, Integer batchSize) {
        SellerspriteRequestRun run = runMapper.selectById(runId);
        if (run == null) throw new IllegalArgumentException("任务不存在: " + runId);
        String status = run.getStatus();
        if ("PAUSED".equals(status) || "PAUSED_SYSTEM".equals(status) || "STOPPED".equals(status)) {
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
            SellerspriteRequestRun finalized = runMapper.selectById(runId);
            boolean finished = finalized != null && TERMINAL_STATUS.contains(finalized.getStatus());
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("runId", runId);
            r.put("consumed", 0);
            r.put("status", finalized == null ? status : finalized.getStatus());
            r.put("finished", finished);
            r.put("message", finished ? "无待处理子项，任务已完结" : "请求已完成，清洗层收尾等待自动重试");
            return r;
        }

        int success = 0, failed = 0, skipped = 0, consumed = 0, apiCallsTotal = 0;
        boolean recountRequired = false;
        for (SellerspriteRequestItem item : pending) {
            // 再次检查 run 状态（可能被并发 stop）
            SellerspriteRequestRun fresh = runMapper.selectById(runId);
            if ("STOPPED".equals(fresh.getStatus()) || "PAUSED".equals(fresh.getStatus())
                    || "PAUSED_SYSTEM".equals(fresh.getStatus())) {
                log.info("任务 {} 被 {}，停止消费剩余子项", runId, fresh.getStatus());
                break;
            }
            if (SellerspriteSellerNamePolicy.isBlocked(item.getSellerName())) {
                int marked = itemMapper.markPendingSkipped(
                        item.getId(), SellerspriteSellerNamePolicy.BLOCKED_AMAZON_REASON);
                if (marked > 0) {
                    consumed++;
                    skipped++;
                    log.info("请求中心跳过禁止店名: runId={}, itemId={}, sellerName={}",
                            runId, item.getId(), item.getSellerName());
                }
                continue;
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
                int itemFailed = getInt(syncResult, "failedCount", Math.max(0, fetched - written));
                boolean truncated = Boolean.TRUE.equals(syncResult.get("truncated"));
                String itemStatus = itemFailed > 0 || truncated ? "PARTIAL_SUCCESS" : "SUCCESS";

                // 写回 item（事务外抓取，事务内写回）
                transactionTemplate.executeWithoutResult(s ->
                        markItemSuccess(item.getId(), runId, syncResult, total, fetched, written, itemFailed, apiCalls, itemStatus));
                success++;
                apiCallsTotal += apiCalls;
            } catch (SellerspriteExecutionException e) {
                if (requiresSystemPause(e)) {
                    String summary = truncate(e.getMessage(), 512);
                    LocalDateTime retryAt = safeRetryAt(e, item);
                    transactionTemplate.executeWithoutResult(s -> {
                        itemMapper.markWaitingRetry(item.getId(), summary, e.getErrorCode().name(), summary,
                                e.isRequestDispatched(), e.isUsageConfirmed(), retryAt);
                        runMapper.pauseSystem(runId, e.getErrorCode().name() + ": " + summary, retryAt);
                    });
                    recountRequired = true;
                    log.warn("卖家精灵保护暂停任务: runId={}, itemId={}, code={}, dispatched={}, retryAt={}, error={}",
                            runId, item.getId(), e.getErrorCode(), e.isRequestDispatched(), retryAt, summary);
                    break;
                }
                String errMsg = truncate(e.getMessage(), 512);
                transactionTemplate.executeWithoutResult(s -> {
                    markItemFailed(item.getId(), runId, null, errMsg, 0, 0, 0, 0, 0);
                    SellerspriteRequestItem failedItem = itemMapper.selectById(item.getId());
                    failedItem.setErrorCode(e.getErrorCode().name());
                    failedItem.setErrorSummary(errMsg);
                    failedItem.setRequestDispatched(e.isRequestDispatched());
                    failedItem.setUsageConfirmed(e.isUsageConfirmed());
                    itemMapper.updateById(failedItem);
                });
                failed++;
                log.warn("请求中心子项业务失败: runId={}, itemId={}, code={}, error={}",
                        runId, item.getId(), e.getErrorCode(), errMsg);
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
        if (recountRequired) {
            runMapper.recountItemCounters(runId);
        } else if (consumed > 0) {
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
        // ── ASIN 批量查询 ──────────────────────────────────────────
        if ("ASIN_BATCH_LOOKUP".equals(run.getRequestType())
                || "MANUAL_ASIN_LOOKUP".equals(run.getRequestType())
                || "PREMIUM_ASIN_LOOKUP".equals(run.getRequestType())
                || "BRS_ASIN_LOOKUP".equals(run.getRequestType())) {
            if (item.getAsinList() == null || item.getAsinList().isBlank()) {
                throw new IllegalStateException("ASIN_BATCH_LOOKUP item 缺少 asin_list");
            }
            List<String> asins;
            try {
                asins = OBJECT_MAPPER.readValue(item.getAsinList(),
                        OBJECT_MAPPER.getTypeFactory().constructCollectionType(List.class, String.class));
            } catch (Exception e) {
                throw new IllegalStateException("解析 asin_list 失败: " + e.getMessage());
            }
            if (asins == null || asins.isEmpty()) {
                throw new IllegalStateException("asin_list 解析结果为空");
            }

            String month = resolveRunMonth(run);
            CompetitorLookupRequest req = readLookupPayload(item);
            if (req == null) {
                req = new CompetitorLookupRequest();
            }
            // 强制父体口径 + 一次拉全：40 ASIN 用 size=100 一页返回，避免满页翻页导致每批双倍调用。
            // 原实现在 if(req==null) 内设置，payload 非空时（默认 size=50）被短路 → 满页翻2页 → 配额翻倍。
            req.setVariation("Y");  // 不含变体，父体口径，与店铺请求一致
            req.setSize(100);
            req.setMarketplace(item.getMarketplace() != null ? item.getMarketplace() : run.getMarketplace());
            req.setAsins(new ArrayList<>(asins));

            String itemMarketplace = req.getMarketplace();
            String scope = "marketplace=" + itemMarketplace + ", asins=" + asins.size();
            AtomicInteger attemptNo = new AtomicInteger(nvl(item.getAttemptCount()));
            Function<CompetitorLookupRequest, JsonNode> executor = apiRequest ->
                    executionGateway.execute(new SellerspriteExecutionRequest(apiRequest,
                            new SellerspriteExecutionContext(run.getRunId(), item.getId(), run.getRequestType(),
                                    scope, attemptNo.incrementAndGet()))).data();
            Map<String, Object> raw;
            if ("PREMIUM_ASIN_LOOKUP".equals(run.getRequestType())) {
                Map<String, Object> meta = readRunMeta(run);
                raw = competitorService.doPremiumLookupAndSave(
                        req,
                        StringUtils.hasText(month) ? month : currentDataMonth(),
                        LocalDateTime.now(),
                        toLong(meta.get("mappingId")),
                        stringValue(meta.get("bazhuayuTaskId")),
                        stringValue(meta.get("taskName")),
                        stringValue(meta.get("weekTag")),
                        run.getRunId(),
                        executor);
            } else if ("BRS_ASIN_LOOKUP".equals(run.getRequestType())) {
                Map<String, Object> meta = readRunMeta(run);
                raw = brsRankingService.doLookupAndSave(
                        req,
                        StringUtils.hasText(month) ? month : currentDataMonth(),
                        run.getBatchDate(),
                        stringValue(meta.get("batchLabel")),
                        run.getRunId(),
                        LocalDateTime.now(),
                        executor);
            } else {
                raw = competitorService.doLookupAndSave(req,
                        StringUtils.hasText(month) ? month : currentDataMonth(), LocalDateTime.now(), executor);
            }
            int total = ((Number) raw.getOrDefault("total", 0)).intValue();
            int apiCalls = ((Number) raw.getOrDefault("apiCalls", 0)).intValue();

            // 请求过的 ASIN 写入 skip_asins「API已请求」，下次导入不再重复请求扣费。
            // 与旧链路 AsinImportService.executeApiCalls 每批收尾一致；insertBatchIgnoreDup 幂等，重复写无害。
            // BRS 榜单隔离：不写共享 skip_asins，避免污染竞品/新品榜的「API已请求」去重。
            if (!"PREMIUM_ASIN_LOOKUP".equals(run.getRequestType())
                    && !"BRS_ASIN_LOOKUP".equals(run.getRequestType())) {
                markAsinsRequested(asins, itemMarketplace);
            }

            // 补齐 consumeNext 期望的 key（与 syncBySellerName 返回格式对齐）
            Map<String, Object> result = new LinkedHashMap<>(raw);
            result.putIfAbsent("fetchedCount", total);
            result.putIfAbsent("writtenCount", total);
            return result;
        }

        // ── 候选池批量抓取 ──────────────────────────────────────────
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

        if ("DENG_ZONG_SHOP_SYNC".equals(run.getRequestType())) {
            return dengZongShopService.syncBySellerName(item.getSellerName(), item.getMarketplace());
        }

        if ("SELLER_BATCH_LOOKUP".equals(run.getRequestType())) {
            CompetitorLookupRequest req = new CompetitorLookupRequest();
            req.setMarketplace(item.getMarketplace());
            req.setSellerName(item.getSellerName());
            req.setAsins(List.of());
            req.setVariation("Y");  // 不含变体，父体口径，与店铺请求一致
            req.setSize(100);
            AtomicInteger attemptNo = new AtomicInteger(nvl(item.getAttemptCount()));
            String scope = "marketplace=" + item.getMarketplace() + ", seller=" + item.getSellerName();
            Map<String, Object> raw = competitorService.doLookupAndSave(req, currentDataMonth(), LocalDateTime.now(),
                    apiRequest -> executionGateway.execute(new SellerspriteExecutionRequest(apiRequest,
                            new SellerspriteExecutionContext(run.getRunId(), item.getId(), run.getRequestType(),
                                    scope, attemptNo.incrementAndGet()))).data());
            raw.putIfAbsent("fetchedCount", raw.getOrDefault("total", 0));
            raw.putIfAbsent("writtenCount", raw.getOrDefault("total", 0));
            return raw;
        }

        // ── 默认：店铺全量同步 ──────────────────────────────────────
        return productSyncService.syncBySellerName(
                item.getSellerName(), item.getMarketplace(), run.getFetchReason(),
                null, null, run.getBatchCode(), () -> {
                    SellerspriteRequestRun fresh = runMapper.selectById(run.getRunId());
                    return fresh != null && "RUNNING".equals(fresh.getStatus());
                }, false);
    }

    // ── list / detail ────────────────────────────────────────────

    public PageResult<SellerspriteRequestRun> listRuns(String requestType, String triggerType, String status,
                                                       String batchCode, String month, Integer page, Integer size) {
        int p = Math.max(1, page == null ? 1 : page);
        int s = Math.max(1, Math.min(size == null ? 50 : size, 200));
        MonthRange monthRange = StringUtils.hasText(month) ? resolveMonthRange(month) : null;
        LambdaQueryWrapper<SellerspriteRequestRun> qw = new LambdaQueryWrapper<SellerspriteRequestRun>()
                .eq(StringUtils.hasText(requestType), SellerspriteRequestRun::getRequestType, requestType)
                .eq(StringUtils.hasText(triggerType), SellerspriteRequestRun::getTriggerType, triggerType)
                .eq(StringUtils.hasText(status), SellerspriteRequestRun::getStatus, status)
                .eq(StringUtils.hasText(batchCode), SellerspriteRequestRun::getBatchCode, batchCode);
        if (monthRange != null) {
            qw.ge(SellerspriteRequestRun::getCreatedAt, monthRange.start())
                    .lt(SellerspriteRequestRun::getCreatedAt, monthRange.endExclusive());
        }
        qw.orderByDesc(SellerspriteRequestRun::getCreatedAt);
        Page<SellerspriteRequestRun> mpPage = new Page<>(p, s);
        Page<SellerspriteRequestRun> result = runMapper.selectPage(mpPage, qw);
        return PageResult.of(result.getRecords(), result.getTotal(), (long) p, (long) s);
    }

    public Map<String, Object> monthlyUsageSummary(String month) {
        MonthRange monthRange = resolveMonthRange(StringUtils.hasText(month)
                ? month : YearMonth.now().toString());
        LambdaQueryWrapper<SellerspriteRequestRun> countWrapper = new LambdaQueryWrapper<>();
        countWrapper.ge(SellerspriteRequestRun::getCreatedAt, monthRange.start())
                .lt(SellerspriteRequestRun::getCreatedAt, monthRange.endExclusive());
        long taskCount = runMapper.selectCount(countWrapper);
        Long apiCalls = runMapper.sumApiCallsByCreatedAt(monthRange.start(), monthRange.endExclusive());
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("month", monthRange.month().toString());
        summary.put("taskCount", taskCount);
        summary.put("totalApiCalls", apiCalls == null ? 0L : apiCalls);
        return summary;
    }

    public SellerspriteRequestRun getRun(String runId) {
        SellerspriteRequestRun run = runMapper.selectById(runId);
        if (run == null) throw new IllegalArgumentException("任务不存在: " + runId);
        return run;
    }

    /**
     * 任务子项分页查询（按 seq 升序）。大任务子项可达数千条，禁止一次性全量返回给前端渲染，
     * 否则详情抽屉会一次渲染上万 DOM 导致卡死。size 默认 20、上限 200。
     */
    public PageResult<SellerspriteRequestItem> listItems(String runId, Integer page, Integer size) {
        int p = Math.max(1, page == null ? 1 : page);
        int s = Math.max(1, Math.min(size == null ? 20 : size, 200));
        LambdaQueryWrapper<SellerspriteRequestItem> qw = new LambdaQueryWrapper<SellerspriteRequestItem>()
                .eq(SellerspriteRequestItem::getRunId, runId)
                .orderByAsc(SellerspriteRequestItem::getSeq);
        Page<SellerspriteRequestItem> mpPage = new Page<>(p, s);
        Page<SellerspriteRequestItem> result = itemMapper.selectPage(mpPage, qw);
        return PageResult.of(result.getRecords(), result.getTotal(), (long) p, (long) s);
    }

    /** 重试单条 FAILED item：置回 PENDING，run 重新打开为 RUNNING（若已完结）。 */
    @Transactional
    public int retryItem(Long itemId) {
        SellerspriteRequestItem item = itemMapper.selectById(itemId);
        if (item == null) throw new IllegalArgumentException("子项不存在: " + itemId);
        if (!"FAILED".equals(item.getStatus()) && !"WAITING_RETRY".equals(item.getStatus())) {
            throw new IllegalStateException("只有 FAILED 或 WAITING_RETRY 子项可重试，当前: " + item.getStatus());
        }
        int reset = itemMapper.resetFailedToPending(itemId);
        if (reset == 0) return 0;
        itemMapper.reopenForRetry(item.getRunId());
        runMapper.recountItemCounters(item.getRunId());
        startAutoConsumeAfterCommit(item.getRunId());
        log.info("请求中心子项重试: runId={}, itemId={}", item.getRunId(), itemId);
        return reset;
    }

    // ── internal helpers ─────────────────────────────────────────

    private String resolveDataMonth(AsinImportTask task) {
        if (StringUtils.hasText(task.getDataMonth())) {
            return task.getDataMonth();
        }
        if (task.getCreatedAt() != null) {
            return task.getCreatedAt().toLocalDate().format(DateTimeFormatter.ofPattern("yyyyMM"));
        }
        return currentDataMonth();
    }

    private String currentDataMonth() {
        return java.time.YearMonth.now().format(DateTimeFormatter.ofPattern("yyyyMM"));
    }

    private MonthRange resolveMonthRange(String month) {
        try {
            YearMonth parsed = YearMonth.parse(month.trim());
            return new MonthRange(parsed, parsed.atDay(1).atStartOfDay(),
                    parsed.plusMonths(1).atDay(1).atStartOfDay());
        } catch (DateTimeParseException | NullPointerException e) {
            throw new IllegalArgumentException("month 必须为 yyyy-MM 格式");
        }
    }

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
        if (syncResult.get("warning") != null) {
            item.setErrorMessage(truncate(String.valueOf(syncResult.get("warning")), 512));
        }
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
        // 暂停不强制完结（用户/系统恢复后可继续）
        if ("PAUSED".equals(status) || "PAUSED_SYSTEM".equals(status)) return;

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
        // ASIN 批量查询写入 competitor_products 后，补做旧链路同款收尾：打周标 + 刷清洗层，
        // 否则新品榜/方法卡（读 competitor_products_clean）看不到本批数据。店铺类任务走 shop_products
        // 独立链路，不触发此收尾。
        if (success > 0 && writesCompetitorProducts(run.getRequestType())) {
            if (!finalizeCompetitorCleanLayer(run)) {
                return;
            }
        }

        // 只有业务落表以及必须的 clean 收尾都成功后，任务才能进入成功终态。
        run.setStatus(finalStatus);
        run.setFinishedAt(LocalDateTime.now());
        run.setSystemPauseReason(null);
        run.setSystemResumeAt(null);
        runMapper.updateById(run);
        log.info("请求中心任务完结: runId={}, status={}, success={}, failed={}, apiCalls={}",
                runId, finalStatus, success, failed, run.getApiCalls());

        if (success > 0 && writesShopProducts(run.getRequestType())) {
            finalizeShopSummarySnapshot(run);
        }
    }

    private boolean writesShopProducts(String requestType) {
        return Set.of("SHOP_FULL_LOOKUP", "CANDIDATE_BATCH", "PREMIUM_REFRESH").contains(requestType);
    }

    private void finalizeShopSummarySnapshot(SellerspriteRequestRun run) {
        try {
            int count = shopCollectionService.refreshSellerSummarySnapshot(run.getMarketplace());
            log.info("请求中心任务完结后店铺聚合画像快照已刷新: runId={}, marketplace={}, shops={}",
                    run.getRunId(), run.getMarketplace(), count);
        } catch (Exception e) {
            log.error("请求中心任务完结后店铺聚合画像快照刷新失败(不影响任务完结): runId={}, marketplace={}, err={}",
                    run.getRunId(), run.getMarketplace(), e.getMessage(), e);
        }
    }

    /**
     * 结果写进 competitor_products、需要清洗层收尾（打周标 + 刷 clean）的任务类型。
     * 与 {@link #consumeSellerSpriteItem} 里走 competitorService.doLookupAndSave 的分支保持一致：
     * ASIN_BATCH_LOOKUP / MANUAL_ASIN_LOOKUP / SELLER_BATCH_LOOKUP。
     * （ASIN_LOOKUP 为历史预留常量，无消费分支，不在此列。）
     */
    private boolean writesCompetitorProducts(String requestType) {
        return "ASIN_BATCH_LOOKUP".equals(requestType)
                || "MANUAL_ASIN_LOOKUP".equals(requestType)
                || "SELLER_BATCH_LOOKUP".equals(requestType);
    }

    /**
     * 把请求过的 ASIN 写入 skip_asins「API已请求」，下次初筛/导入去重不再重复扣费。
     * 与 AsinImportService.executeApiCalls 每批收尾一致。异常不影响主流程。
     */
    private void markAsinsRequested(List<String> asins, String marketplace) {
        if (asins == null || asins.isEmpty()) return;
        try {
            List<SkipAsin> skips = new ArrayList<>(asins.size());
            for (String asin : asins) {
                if (asin == null || asin.isBlank()) continue;
                SkipAsin s = new SkipAsin();
                s.setAsin(asin);
                s.setMarketplace(marketplace);
                s.setFilterReasons("API已请求");
                skips.add(s);
            }
            if (!skips.isEmpty()) skipAsinMapper.insertBatchIgnoreDup(skips);
        } catch (Exception e) {
            log.warn("写入 skip_asins(API已请求) 失败(忽略): marketplace={}, asins={}, err={}",
                    marketplace, asins.size(), e.getMessage());
        }
    }

    /** 打周标 + 增量刷清洗层。失败时暂停任务并自动重试，禁止带病进入成功终态。 */
    private boolean finalizeCompetitorCleanLayer(SellerspriteRequestRun run) {
        try {
            String weekTag = scoringService.updateWeekTags();
            Map<String, Object> cleanResult = cleanLayerService.cleanWeekBatch(run.getMarketplace(), weekTag);
            log.info("请求中心任务完结后清洗层刷新: runId={}, marketplace={}, weekTag={}, affected={}",
                    run.getRunId(), run.getMarketplace(), weekTag, cleanResult.get("affectedRows"));
            return true;
        } catch (Exception e) {
            String reason = CLEAN_FINALIZATION_REASON_PREFIX
                    + truncate(e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName(), 400);
            LocalDateTime retryAt = LocalDateTime.now().plusSeconds(CLEAN_FINALIZATION_RETRY_SECONDS);
            int paused = runMapper.pauseSystem(run.getRunId(), reason, retryAt);
            log.error("请求中心任务清洗层刷新失败，已暂停并等待自动重试: runId={}, marketplace={}, retryAt={}, paused={}, err={}",
                    run.getRunId(), run.getMarketplace(), retryAt, paused, e.getMessage(), e);
            return false;
        }
    }

    private boolean isCleanFinalizationRetry(SellerspriteRequestRun run) {
        return run != null
                && "PAUSED_SYSTEM".equals(run.getStatus())
                && run.getSystemPauseReason() != null
                && run.getSystemPauseReason().startsWith(CLEAN_FINALIZATION_REASON_PREFIX)
                && nvl(run.getPendingCount()) == 0;
    }

    private int getInt(Map<String, Object> map, String key, int def) {
        Object v = map.get(key);
        if (v == null) return def;
        if (v instanceof Number n) return n.intValue();
        try { return Integer.parseInt(v.toString()); } catch (Exception e) { return def; }
    }

    private int nvl(Integer v) { return v == null ? 0 : v; }

    private boolean requiresSystemPause(SellerspriteExecutionException error) {
        return switch (error.getErrorCode()) {
            case CONNECT_TIMEOUT, READ_TIMEOUT, NETWORK, CIRCUIT_OPEN, RATE_LIMIT, INTERNAL_ERROR -> true;
            case AUTH, INVALID_REQUEST, UPSTREAM_ERROR, PARSE_ERROR -> false;
        };
    }

    private LocalDateTime safeRetryAt(SellerspriteExecutionException error, SellerspriteRequestItem item) {
        if (error.getRetryAt() != null) return error.getRetryAt();
        if (error.isRequestDispatched()) return null;
        return switch (error.getErrorCode()) {
            case CONNECT_TIMEOUT, NETWORK -> LocalDateTime.now().plusSeconds(Math.min(60,
                    5L * (1L << Math.min(4, nvl(item.getAttemptCount())))));
            case RATE_LIMIT -> LocalDateTime.now().plusSeconds(30);
            default -> null;
        };
    }

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

    /** 构造只含 month 的 triggerRef JSON，避免字符串拼接导致的 JSON 破坏。 */
    private String writeMonthTriggerRef(String month) {
        try { return OBJECT_MAPPER.writeValueAsString(Map.of("month", month == null ? "" : month)); }
        catch (JsonProcessingException e) { throw new IllegalStateException("序列化 triggerRef 失败", e); }
    }

    /** BRS 任务 run 级 meta：month（供 resolveRunMonth）+ batchLabel（供 consume 传给 brsRankingService）。 */
    private String writeBrsMetaForRun(String month, String batchLabel) {
        try {
            return OBJECT_MAPPER.writeValueAsString(Map.of(
                    "month", month == null ? "" : month,
                    "batchLabel", batchLabel == null ? "" : batchLabel));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("序列化 BRS triggerRef 失败", e);
        }
    }

    private String writeAsinList(List<String> asins) {
        try { return OBJECT_MAPPER.writeValueAsString(asins); }
        catch (JsonProcessingException e) { throw new IllegalStateException("序列化 ASIN 载荷失败", e); }
    }

    private String writeLookupPayload(CompetitorLookupRequest request) {
        try { return OBJECT_MAPPER.writeValueAsString(request); }
        catch (JsonProcessingException e) { throw new IllegalStateException("序列化卖家精灵请求载荷失败", e); }
    }

    private CompetitorLookupRequest readLookupPayload(SellerspriteRequestItem item) {
        if (!StringUtils.hasText(item.getPayloadJson())) return null;
        try {
            return OBJECT_MAPPER.readValue(item.getPayloadJson(), CompetitorLookupRequest.class);
        } catch (Exception e) {
            throw new IllegalStateException("请求中心子项请求载荷解析失败: itemId=" + item.getId(), e);
        }
    }

    private CompetitorLookupRequest copyLookupRequest(CompetitorLookupRequest source, List<String> asins) {
        CompetitorLookupRequest copy = new CompetitorLookupRequest();
        copy.setMarketplace(source.getMarketplace());
        copy.setBrand(source.getBrand());
        copy.setSellerName(source.getSellerName());
        copy.setAsins(new ArrayList<>(asins));
        copy.setNodeIdPath(source.getNodeIdPath());
        copy.setNodeIdPathEqual(source.getNodeIdPathEqual());
        copy.setKeyword(source.getKeyword());
        copy.setMatchType(source.getMatchType());
        copy.setVariation(source.getVariation());
        copy.setPage(source.getPage());
        copy.setSize(source.getSize());
        copy.setOrderField(source.getOrderField());
        copy.setOrderDesc(source.getOrderDesc());
        return copy;
    }

    private Map<String, Object> readRunMeta(SellerspriteRequestRun run) {
        if (!StringUtils.hasText(run.getTriggerRef())) return Map.of();
        try {
            return OBJECT_MAPPER.readValue(run.getTriggerRef(),
                    OBJECT_MAPPER.getTypeFactory().constructMapType(Map.class, String.class, Object.class));
        } catch (Exception e) {
            throw new IllegalStateException("请求中心任务来源信息解析失败: runId=" + run.getRunId(), e);
        }
    }

    private Long toLong(Object value) {
        if (value instanceof Number number) return number.longValue();
        if (value == null) return null;
        try {
            return Long.valueOf(String.valueOf(value));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private String stringValue(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private String resolveRunMonth(SellerspriteRequestRun run) {
        if (StringUtils.hasText(run.getTriggerRef())) {
            try {
                Map<String, Object> meta = OBJECT_MAPPER.readValue(run.getTriggerRef(),
                        OBJECT_MAPPER.getTypeFactory().constructMapType(Map.class, String.class, Object.class));
                Object month = meta.get("month");
                if (month != null && StringUtils.hasText(String.valueOf(month))) return String.valueOf(month);
            } catch (Exception ignored) {
                // 兼容旧任务：无效 triggerRef 时回落到当前数据月份。
            }
        }
        return currentDataMonth();
    }

    private String buildManualAsinIdempotencyKey(CompetitorLookupRequest request, List<String> asins, String month) {
        // ASIN 先排序再入 hash：同一批 ASIN 换序提交应得到同一 key，才能命中活跃任务复用
        List<String> sortedAsins = new ArrayList<>(asins);
        Collections.sort(sortedAsins);
        return "MANUAL_ASIN_" + Integer.toUnsignedString(Objects.hash(
                request.getMarketplace(), month, sortedAsins, request.getBrand(), request.getSellerName(),
                request.getNodeIdPath(), request.getNodeIdPathEqual(), request.getKeyword(), request.getMatchType(),
                request.getVariation(), request.getSize(), request.getOrderField(), request.getOrderDesc()), 36);
    }

    private String buildIdempotencyKey(String requestType, String marketplace, String triggerType,
                                       String triggerRef, List<RequestItemInput> items) {
        String itemKey = items.stream().map(item -> String.valueOf(item.triggerId()) + "@"
                        + item.marketplace() + "@" + item.sellerName())
                .sorted().reduce("", (a, b) -> a + "|" + b);
        return "REQ_" + Integer.toUnsignedString(Objects.hash(requestType, marketplace, triggerType, triggerRef, itemKey), 36);
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

    private record MonthRange(YearMonth month, LocalDateTime start, LocalDateTime endExclusive) {}
}
