package com.sjzm.product.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.toolkit.Db;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sjzm.product.dto.CompetitorLookupRequest;
import com.sjzm.product.config.DatabaseWorkloadGate;
import com.sjzm.product.entity.AsinImportResult;
import com.sjzm.product.entity.AsinImportTask;
import com.sjzm.product.modules.bazhuayu.service.BazhuayuBatchSnapshot;
import com.sjzm.product.modules.bazhuayu.entity.BazhuayuWeeklyRaw;
import com.sjzm.product.modules.bazhuayu.mapper.PremiumProductMapper;
import com.sjzm.product.modules.bazhuayu.entity.PremiumProduct;
import com.sjzm.product.mapper.BazhuayuWeeklyRawMapper;
import com.sjzm.product.entity.CompetitorProduct;
import com.sjzm.product.entity.DengZongShop;
import com.sjzm.product.entity.DengZongShopSeller;
import com.sjzm.product.entity.SkipAsin;
import com.sjzm.product.mapper.AsinImportResultMapper;
import com.sjzm.product.mapper.AsinImportTaskMapper;
import com.sjzm.product.modules.requestcenter.gateway.SellerspriteExecutionGateway;
import com.sjzm.product.modules.requestcenter.gateway.model.SellerspriteExecutionContext;
import com.sjzm.product.modules.requestcenter.gateway.model.SellerspriteExecutionRequest;
import com.sjzm.product.mapper.CompetitorProductMapper;
import com.sjzm.product.mapper.DengZongShopSellerMapper;
import com.sjzm.product.mapper.SkipAsinMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class AsinImportService {

    private static final Pattern PRICE_PATTERN = Pattern.compile("[\\s]*([\\d]+\\.?[\\d]*)");
    private static final Pattern NUMBER_PATTERN = Pattern.compile("[-+]?\\d*\\.?\\d+");
    private static final int BATCH_SIZE = 40;
    private static final long BATCH_API_DELAY_MS = 2000;
    private static final int DB_BATCH_SIZE = 2000; // 每批写入 DB 的行数
    private static final int RESULT_TITLE_MAX_LENGTH = 500;
    
    private static final long SELLER_API_DELAY_MS = 500;
    private static final int STATUS_CHECK_INTERVAL = 5;

    private final AsinImportTaskMapper taskMapper;
    private final AsinImportResultMapper resultMapper;
    private final CompetitorService competitorService;
    private final CompetitorProductMapper competitorProductMapper;
    private final SkipAsinMapper skipAsinMapper;
    private final BazhuayuWeeklyRawMapper bazhuayuWeeklyRawMapper;
    private final PremiumProductMapper premiumProductMapper;
    private final DengZongShopSellerMapper sellerMapper;
    private final DengZongShopService dengZongShopService;
    private final ApiRateLimitService rateLimitService;
    private final InitialFilterConfigService initialFilterConfig;
    private final SellerspriteExecutionGateway executionGateway;
    private final ScoringService scoringService;
    private final CleanLayerService cleanLayerService;
    private final DatabaseWorkloadGate workloadGate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * 应用启动时恢复僵尸任务（容器重启导致 RUNNING 但线程已死）
     */
    @jakarta.annotation.PostConstruct
    public void recoverStaleTasks() {
        try {
            LocalDateTime now = LocalDateTime.now();
            AsinImportTask update = new AsinImportTask();
            update.setTaskStatus("ERROR");
            update.setErrorMessage("容器重启导致任务中断，请重新导入");
            // 恢复也是一次终态转换：显式写 updatedAt + completedAt，避免完成时间为空或停留在旧值。
            update.setUpdatedAt(now);
            update.setCompletedAt(now);
            int updated = taskMapper.update(update,
                    new LambdaQueryWrapper<AsinImportTask>()
                            .in(AsinImportTask::getTaskStatus, List.of("QUEUED", "RUNNING")));
            if (updated > 0) {
                log.info("启动恢复: 将 {} 个僵尸任务标记为 ERROR", updated);
            }
        } catch (Exception e) {
            log.warn("启动恢复僵尸任务失败: {}", e.getMessage());
        }
    }

    /**
     * 上传并筛选多个文件，合并后去重并返回预览结果
     */
    public Map<String, Object> uploadAndFilter(List<MultipartFile> files, String marketplace) {
        log.info("上传 {} 个文件, marketplace={}", files.size(), marketplace);

        // 1. 解析所有文件 → 合并
        List<Map<String, String>> rows = new ArrayList<>();
        for (MultipartFile file : files) {
            String filename = file.getOriginalFilename();
            if (filename == null || filename.isEmpty()) continue;
            try {
                if (filename.endsWith(".json")) {
                    rows.addAll(parseJson(file));
                } else {
                    rows.addAll(parseExcel(file));
                }
                log.info("  文件 {} 解析完成，累计 {} 条", filename, rows.size());
            } catch (Exception e) {
                log.error("  文件 {} 解析失败: {}", filename, e.getMessage());
                throw new RuntimeException("文件 " + filename + " 解析失败: " + e.getMessage(), e);
            }
        }

        log.info("合并解析完成: {} 条记录", rows.size());

        // 文件路径走 import_type=ASIN，复用通用初筛建任务逻辑
        return workloadGate.runHeavyWrite(() -> filterRowsAndCreateTask(rows, marketplace, "ASIN"));
    }

    /**
     * 通用初筛 + 建任务入口（不依赖文件来源）。
     * 文件上传（uploadAndFilter）和八爪鱼自动采集（BazhuayuScheduledService）共用：
     * 查重 → filterRows → 写 skip_asins → 建 asin_import_tasks → 存 asin_import_results → 返回预览。
     *
     * @param rows        已整形的数据行，列序需与文件一致（filterRows 用位置索引 [1]=ASIN/[3]=price/[4]=reviews）
     * @param marketplace UK/DE/US
     * @param importType  ASIN（文件）/ BAZHUAYU_AUTO（自动采集）
     * @return 初筛预览（含 taskId）
     */
    @Transactional
    public Map<String, Object> filterRowsAndCreateTask(List<Map<String, String>> rows,
                                                       String marketplace, String importType) {
        // 1. 从输入提取 ASIN，分批送数据库查重（不加载全表）
        Set<String> inputAsins = extractInputAsins(rows);
        Set<String> blacklistAsins = batchQueryExistingBlacklist(inputAsins, marketplace);
        Set<String> mainTableAsins = batchQueryExistingMainTable(inputAsins, marketplace);
        log.info("查重完成: 输入 {} 个, 命中主表 {} 个, 命中黑名单 {} 个", inputAsins.size(), mainTableAsins.size(), blacklistAsins.size());

        // 2. 执行筛选
        Map<String, List<Map<String, String>>> filterResult = filterRows(rows, blacklistAsins, mainTableAsins, marketplace);

        // 2.5 将初筛不通过 ASIN 写入 skip_asins（后续上传可去重）
        saveFilteredAsinsToSkipTable(filterResult, marketplace);

        // 3. 创建任务记录
        AsinImportTask task = new AsinImportTask();
        task.setMarketplace(marketplace);
        task.setImportType(importType);
        task.setTaskStatus("READY");
        task.setTotalCount(rows.size());
        task.setPassCount(filterResult.get("PASS").size());
        task.setPriceFailCount(filterResult.get("PRICE_FAIL").size());
        task.setReviewFailCount(filterResult.get("REVIEW_FAIL").size());
        task.setDuplicateCount(filterResult.get("DUPLICATE").size());
        task.setSkipCount(filterResult.get("SKIP_BLACKLIST").size() + filterResult.get("SKIP_MAIN").size());

        List<String> passAsins = new ArrayList<>();
        for (Map<String, String> r : filterResult.get("PASS")) {
            passAsins.add(r.get("asin"));
        }
        int fullBatches = passAsins.size() / BATCH_SIZE;
        task.setBatchTotal(fullBatches);
        task.setBatchCurrent(0);
        java.time.LocalDateTime createNow = java.time.LocalDateTime.now();
        task.setCreatedAt(createNow);
        task.setUpdatedAt(createNow);
        task.setCompletedAt(createNow);   // 文件上传初筛建任务即 READY 终态
        taskMapper.insert(task);

        // 4. 保存明细
        saveResults(task.getId(), filterResult, marketplace);

        // 5. 返回预览
        Map<String, Object> preview = new HashMap<>();
        preview.put("taskId", task.getId());
        preview.put("totalCount", rows.size());
        preview.put("passCount", filterResult.get("PASS").size());
        preview.put("priceFailCount", filterResult.get("PRICE_FAIL").size());
        preview.put("reviewFailCount", filterResult.get("REVIEW_FAIL").size());
        preview.put("duplicateCount", filterResult.get("DUPLICATE").size());
        int skipMain = filterResult.get("SKIP_MAIN").size();
        int skipBlacklist = filterResult.get("SKIP_BLACKLIST").size();
        preview.put("skipCount", skipMain + skipBlacklist);
        preview.put("skipMainCount", skipMain);
        preview.put("skipBlacklistCount", skipBlacklist);
        preview.put("batchTotal", fullBatches);
        preview.put("discardedAsins", passAsins.size() - fullBatches * BATCH_SIZE);
        return preview;
    }

    // ============================================================
    // 流式初筛（大数据量：八爪鱼自动采集专用，逐页处理不堆全量）
    // 文件路径仍走上面的 filterRowsAndCreateTask（小数据，单事务最安全）
    // ============================================================

    /**
     * 流式初筛上下文：跨页累计计数 + 全局去重，内存只随 ASIN 总数线性增长。
     */
    public static class StreamingFilterContext {
        final Long taskId;
        final String marketplace;
        final boolean alreadyImported;
        final Set<String> seenAsins = new HashSet<>();   // 跨页去重（in-file 重复）
        int total, pass, priceFail, reviewFail, duplicate, skipBlacklist, skipMain;
        int pageCount;                                   // 已处理页数，用于周期写回节流
        long lastFlushMs = System.currentTimeMillis();   // 上次写回时间戳

        StreamingFilterContext(Long taskId, String marketplace) {
            this(taskId, marketplace, false);
        }

        StreamingFilterContext(Long taskId, String marketplace, boolean alreadyImported) {
            this.taskId = taskId;
            this.marketplace = marketplace;
            this.alreadyImported = alreadyImported;
        }

        public Long getTaskId() { return taskId; }
        public boolean isAlreadyImported() { return alreadyImported; }
    }

    /** 周期写回节流阈值：每 5 页或每 5 秒把累计统计刷进 DB */
    private static final int PROGRESS_FLUSH_PAGES = 5;
    private static final long PROGRESS_FLUSH_INTERVAL_MS = 5000;

    /**
     * 开始一个流式初筛任务：建 RUNNING 任务（计数全 0），返回上下文。
     * 不加 @Transactional —— 长任务逐页提交，不裹大事务。
     */
    public StreamingFilterContext createStreamingTask(String marketplace, String importType) {
        return createStreamingTask(marketplace, importType, null, null, null,
                "默认", true, "competitor_products");
    }

    /** 创建带八爪鱼命名任务来源信息的可见导入任务。 */
    public StreamingFilterContext createStreamingTask(
            String marketplace,
            String importType,
            Long mappingId,
            String bazhuayuTaskId,
            String taskName,
            String taskCategory,
            boolean initialFilter,
            String targetTable) {
        return createStreamingTask(marketplace, importType, mappingId, bazhuayuTaskId,
                taskName, taskCategory, initialFilter, targetTable, null);
    }

    /** 同步预建结果：只有新插入的任务需要提交 worker，重复请求仅复用已有任务。 */
    public record QueuedTask(Long taskId, boolean alreadyImported, boolean shouldSubmit) {}

    /**
     * 同步预建一条 QUEUED 八爪鱼导入任务，让前端点击“导入DB”后立即能看到任务并轮询。
     * 幂等：同 (mappingId, batchNo) 已存在 READY/DONE/ERROR/RUNNING 时不新建，返回其 id 且 alreadyImported=true；
     * 已存在 QUEUED（重复点击）时仅复用其 id，不重复提交 worker。
     */
    @Transactional
    public QueuedTask createQueuedBazhuayuTask(
            String marketplace,
            String importType,
            Long mappingId,
            String bazhuayuTaskId,
            String taskName,
            String taskCategory,
            boolean initialFilter,
            String targetTable,
            BazhuayuBatchSnapshot batch) {
        if (mappingId != null && batch != null && batch.batchNo() != null
                && !batch.batchNo().isBlank()) {
            AsinImportTask existing = taskMapper.selectBazhuayuBatch(mappingId, batch.batchNo());
            if (existing != null) {
                boolean queued = "QUEUED".equals(existing.getTaskStatus());
                log.info("八爪鱼批次已存在: mappingId={}, batchNo={}, taskId={}, status={}, {}",
                        mappingId, batch.batchNo(), existing.getId(), existing.getTaskStatus(),
                        queued ? "复用排队任务继续" : "跳过重复导入");
                return new QueuedTask(existing.getId(), !queued, false);
            }
        }
        AsinImportTask task = new AsinImportTask();
        task.setMarketplace(marketplace);
        task.setImportType(importType);
        task.setTaskStatus("QUEUED");
        task.setTotalCount(0);
        task.setPassCount(0);
        task.setPriceFailCount(0);
        task.setReviewFailCount(0);
        task.setDuplicateCount(0);
        task.setSkipCount(0);
        task.setBatchTotal(0);
        task.setBatchCurrent(0);
        task.setDataMonth(java.time.YearMonth.now()
                .format(java.time.format.DateTimeFormatter.ofPattern("yyyyMM")));
        task.setBazhuayuMappingId(mappingId);
        task.setBazhuayuTaskId(bazhuayuTaskId);
        if (batch != null) {
            task.setBazhuayuBatchNo(batch.batchNo());
            task.setBazhuayuBatchStartTime(batch.startTime());
            task.setBazhuayuBatchEndTime(batch.endTime());
            task.setBazhuayuBatchCount(batch.cloudCount());
            task.setBazhuayuLotNo(batch.lotNo());
        }
        task.setTaskName(taskName);
        task.setTaskCategory(taskCategory);
        task.setInitialFilter(initialFilter);
        task.setTargetTable(targetTable);
        java.time.LocalDateTime now = java.time.LocalDateTime.now();
        task.setCreatedAt(now);
        task.setUpdatedAt(now);
        try {
            taskMapper.insert(task);
        } catch (DuplicateKeyException e) {
            if (mappingId == null || batch == null || batch.batchNo() == null) throw e;
            AsinImportTask winner = taskMapper.selectBazhuayuBatch(mappingId, batch.batchNo());
            if (winner == null) throw e;
            boolean queued = "QUEUED".equals(winner.getTaskStatus());
            log.info("八爪鱼批次并发排队命中已有任务: mappingId={}, batchNo={}, taskId={}, status={}",
                    mappingId, batch.batchNo(), winner.getId(), winner.getTaskStatus());
            return new QueuedTask(winner.getId(), !queued, false);
        }
        log.info("八爪鱼导入任务已排队: taskId={}, marketplace={}, taskName={}, batchNo={}",
                task.getId(), marketplace, taskName, batch == null ? null : batch.batchNo());
        return new QueuedTask(task.getId(), false, true);
    }

    /** 异步导入前置阶段失败时，把同步预建的 QUEUED/RUNNING 任务标记为 ERROR，避免永远停留在排队态。 */
    public void failBazhuayuTaskById(Long taskId, String errorMessage) {
        if (taskId == null) return;
        try {
            AsinImportTask task = taskMapper.selectById(taskId);
            if (task == null) return;
            String st = task.getTaskStatus();
            // 已收口的任务不覆盖
            if ("READY".equals(st) || "DONE".equals(st)) return;
            AsinImportTask update = new AsinImportTask();
            update.setId(taskId);
            update.setTaskStatus("ERROR");
            update.setErrorMessage(truncateText(errorMessage, 1000));
            java.time.LocalDateTime now = java.time.LocalDateTime.now();
            update.setUpdatedAt(now);
            update.setCompletedAt(now);
            taskMapper.updateById(update);
        } catch (RuntimeException e) {
            log.warn("标记八爪鱼任务 {} 为 ERROR 失败(忽略): {}", taskId, e.getMessage());
        }
    }

    /** 创建八爪鱼导入任务；同一配置的同一云端批次只允许创建一次。 */
    public StreamingFilterContext createStreamingTask(
            String marketplace,
            String importType,
            Long mappingId,
            String bazhuayuTaskId,
            String taskName,
            String taskCategory,
            boolean initialFilter,
            String targetTable,
            BazhuayuBatchSnapshot batch) {
        if (mappingId != null && batch != null && batch.batchNo() != null
                && !batch.batchNo().isBlank()) {
            AsinImportTask existing = taskMapper.selectBazhuayuBatch(mappingId, batch.batchNo());
            if (existing != null) {
                // QUEUED = trigger 同步预建的排队任务，复用它转 RUNNING 继续，不新建。
                if ("QUEUED".equals(existing.getTaskStatus())) {
                    AsinImportTask run = new AsinImportTask();
                    run.setId(existing.getId());
                    run.setTaskStatus("RUNNING");
                    run.setUpdatedAt(java.time.LocalDateTime.now());
                    taskMapper.updateById(run);
                    log.info("复用排队任务继续导入: mappingId={}, batchNo={}, taskId={}",
                            mappingId, batch.batchNo(), existing.getId());
                    return new StreamingFilterContext(existing.getId(), marketplace);
                }
                // READY/DONE/RUNNING/ERROR 均视为已存在（ERROR 重试留待后续批次处理）。
                log.info("八爪鱼批次已导入，跳过重复任务: mappingId={}, batchNo={}, taskId={}, status={}",
                        mappingId, batch.batchNo(), existing.getId(), existing.getTaskStatus());
                return new StreamingFilterContext(existing.getId(), marketplace, true);
            }
        }
        AsinImportTask task = new AsinImportTask();
        task.setMarketplace(marketplace);
        task.setImportType(importType);
        task.setTaskStatus("RUNNING");
        task.setTotalCount(0);
        task.setPassCount(0);
        task.setPriceFailCount(0);
        task.setReviewFailCount(0);
        task.setDuplicateCount(0);
        task.setSkipCount(0);
        task.setBatchTotal(0);
        task.setBatchCurrent(0);
        task.setDataMonth(java.time.YearMonth.now()
                .format(java.time.format.DateTimeFormatter.ofPattern("yyyyMM")));
        task.setBazhuayuMappingId(mappingId);
        task.setBazhuayuTaskId(bazhuayuTaskId);
        if (batch != null) {
            task.setBazhuayuBatchNo(batch.batchNo());
            task.setBazhuayuBatchStartTime(batch.startTime());
            task.setBazhuayuBatchEndTime(batch.endTime());
            task.setBazhuayuBatchCount(batch.cloudCount());
            task.setBazhuayuLotNo(batch.lotNo());
        }
        task.setTaskName(taskName);
        task.setTaskCategory(taskCategory);
        task.setInitialFilter(initialFilter);
        task.setTargetTable(targetTable);
        task.setCreatedAt(java.time.LocalDateTime.now());
        task.setUpdatedAt(java.time.LocalDateTime.now());
        taskMapper.insert(task);
        log.info("八爪鱼导入任务已创建: taskId={}, marketplace={}, taskName={}, category={}, initialFilter={}",
                task.getId(), marketplace, taskName, taskCategory, initialFilter);
        return new StreamingFilterContext(task.getId(), marketplace);
    }

    /**
     * 处理一页数据：本页 ASIN 查重 → 复用 filterRows 分桶 → 立即落库 results/skip → 累加计数。
     * 跨页去重靠 ctx.seenAsins：本页内已在之前页出现过的 ASIN 直接计 DUPLICATE，不再进 filterRows。
     * 每页独立小事务（Db.saveBatch 自带），不汇成大事务。
     */
    public void filterPageAndAppend(StreamingFilterContext ctx, List<Map<String, String>> pageRows) {
        String mp = ctx.marketplace;
        ctx.total += pageRows.size();

        // 跨页去重：剔除之前页已见的 ASIN，计入 duplicate
        List<Map<String, String>> fresh = new ArrayList<>(pageRows.size());
        for (Map<String, String> row : pageRows) {
            String asin = findAsin(row);
            if (asin != null && asin.matches("^B0[0-9A-Z]{8}$") && ctx.seenAsins.contains(asin)) {
                ctx.duplicate++;   // 跨页重复
                continue;
            }
            fresh.add(row);
        }

        // 本页 ASIN 查重（复用现有分批查询）
        Set<String> pageAsins = extractInputAsins(fresh);
        Set<String> blacklist = batchQueryExistingBlacklist(pageAsins, mp);
        Set<String> mainTable = batchQueryExistingMainTable(pageAsins, mp);

        // 复用现有 filterRows 分桶（其内部 seen 负责本页内去重）
        Map<String, List<Map<String, String>>> result = filterRows(fresh, blacklist, mainTable, mp);

        // 落库：明细 + skip_asins（均已分批）
        saveResults(ctx.taskId, result, mp);
        saveFilteredAsinsToSkipTable(result, mp);

        // PASS 的 ASIN 也写 skip_asins（请求过不再重复），并登记到全局去重
        List<SkipAsin> passSkips = new ArrayList<>();
        for (Map<String, String> row : result.get("PASS")) {
            String asin = row.get("asin");
            ctx.seenAsins.add(asin);
            SkipAsin s = new SkipAsin();
            s.setAsin(asin);
            s.setMarketplace(mp);
            s.setFilterReasons("初筛PASS");
            passSkips.add(s);
        }
        // 非 PASS 的也登记去重（避免跨页再处理）
        for (String key : List.of("PRICE_FAIL", "REVIEW_FAIL", "SKIP_BLACKLIST", "SKIP_MAIN", "DUPLICATE")) {
            for (Map<String, String> row : result.get(key)) {
                String asin = row.get("asin");
                if (asin != null) ctx.seenAsins.add(asin);
            }
        }
        if (!passSkips.isEmpty()) skipAsinMapper.insertBatchIgnoreDup(passSkips);

        // 累加计数
        ctx.pass += result.get("PASS").size();
        ctx.priceFail += result.get("PRICE_FAIL").size();
        ctx.reviewFail += result.get("REVIEW_FAIL").size();
        ctx.duplicate += result.get("DUPLICATE").size();
        ctx.skipBlacklist += result.get("SKIP_BLACKLIST").size();
        ctx.skipMain += result.get("SKIP_MAIN").size();

        // 周期写回：每 5 页或每 5 秒把累计统计刷进 RUNNING 任务，让前端看到实时进度
        ctx.pageCount++;
        long now = System.currentTimeMillis();
        if (ctx.pageCount % PROGRESS_FLUSH_PAGES == 0 || now - ctx.lastFlushMs >= PROGRESS_FLUSH_INTERVAL_MS) {
            flushProgress(ctx);
            ctx.lastFlushMs = now;
        }
    }

    /**
     * 不初筛导入：仅做合法 ASIN 校验与任务内去重，全部唯一 ASIN 记为 PASS。
     * 不查询主表/黑名单，也不写 skip_asins，保证精品链路与精铺去重完全隔离。
     */
    public void appendPageWithoutInitialFilter(StreamingFilterContext ctx, List<Map<String, String>> pageRows) {
        ctx.total += pageRows.size();
        Map<String, List<Map<String, String>>> result = new LinkedHashMap<>();
        result.put("PASS", new ArrayList<>());
        result.put("DUPLICATE", new ArrayList<>());

        for (Map<String, String> row : pageRows) {
            String asin = findAsin(row);
            if (asin == null || !asin.matches("^B0[0-9A-Z]{8}$")) continue;
            Map<String, String> normalized = new LinkedHashMap<>(row);
            normalized.put("asin", asin);
            if (!ctx.seenAsins.add(asin)) {
                result.get("DUPLICATE").add(normalized);
            } else {
                result.get("PASS").add(normalized);
            }
        }

        saveResults(ctx.taskId, result, ctx.marketplace);
        ctx.pass += result.get("PASS").size();
        ctx.duplicate += result.get("DUPLICATE").size();
        ctx.pageCount++;
        long now = System.currentTimeMillis();
        if (ctx.pageCount % PROGRESS_FLUSH_PAGES == 0 || now - ctx.lastFlushMs >= PROGRESS_FLUSH_INTERVAL_MS) {
            flushProgress(ctx);
            ctx.lastFlushMs = now;
        }
    }

    /**
     * 把当前累计统计写回 asin_import_tasks（保持 RUNNING，不改状态、不定 batchTotal）。
     * 供流式初筛处理中周期调用，让 overview 能读到实时进度；收口仍由 finishStreamingTask 负责。
     */
    private void flushProgress(StreamingFilterContext ctx) {
        try {
            AsinImportTask task = new AsinImportTask();
            task.setId(ctx.taskId);
            task.setTotalCount(ctx.total);
            task.setPassCount(ctx.pass);
            task.setPriceFailCount(ctx.priceFail);
            task.setReviewFailCount(ctx.reviewFail);
            task.setDuplicateCount(ctx.duplicate);
            task.setSkipCount(ctx.skipBlacklist + ctx.skipMain);
            task.setUpdatedAt(java.time.LocalDateTime.now());
            taskMapper.updateById(task);
        } catch (RuntimeException e) {
            // 写回进度失败不能中断导入主流程，仅记录
            log.warn("流式初筛进度写回失败(忽略): taskId={}, err={}", ctx.taskId, e.getMessage());
        }
    }

    /**
     * 收尾：用累计计数回填任务，status 置 READY，返回预览（结构与 filterRowsAndCreateTask 一致）。
     */
    public Map<String, Object> finishStreamingTask(StreamingFilterContext ctx) {
        // 与 executeApiCalls 一致：批次数向上取整，尾批不足 BATCH_SIZE 仍会执行，不丢弃 ASIN
        int totalBatches = (ctx.pass + BATCH_SIZE - 1) / BATCH_SIZE;
        AsinImportTask task = taskMapper.selectById(ctx.taskId);
        task.setTaskStatus("READY");
        task.setTotalCount(ctx.total);
        task.setPassCount(ctx.pass);
        task.setPriceFailCount(ctx.priceFail);
        task.setReviewFailCount(ctx.reviewFail);
        task.setDuplicateCount(ctx.duplicate);
        task.setSkipCount(ctx.skipBlacklist + ctx.skipMain);
        task.setBatchTotal(totalBatches);
        java.time.LocalDateTime finishNow = java.time.LocalDateTime.now();
        task.setUpdatedAt(finishNow);
        task.setCompletedAt(finishNow);   // READY 是流式初筛的终态，写入真实完成时间
        taskMapper.updateById(task);

        Map<String, Object> preview = new HashMap<>();
        preview.put("taskId", ctx.taskId);
        preview.put("totalCount", ctx.total);
        preview.put("passCount", ctx.pass);
        preview.put("priceFailCount", ctx.priceFail);
        preview.put("reviewFailCount", ctx.reviewFail);
        preview.put("duplicateCount", ctx.duplicate);
        preview.put("skipCount", ctx.skipBlacklist + ctx.skipMain);
        preview.put("skipMainCount", ctx.skipMain);
        preview.put("skipBlacklistCount", ctx.skipBlacklist);
        preview.put("batchTotal", totalBatches);
        preview.put("discardedAsins", 0);
        log.info("流式初筛完成: taskId={}, total={}, pass={}", ctx.taskId, ctx.total, ctx.pass);
        return preview;
    }

    public void failStreamingTask(StreamingFilterContext ctx, String errorMessage) {
        if (ctx == null) return;
        AsinImportTask task = taskMapper.selectById(ctx.taskId);
        if (task == null) return;
        task.setTaskStatus("ERROR");
        task.setTotalCount(ctx.total);
        task.setPassCount(ctx.pass);
        task.setPriceFailCount(ctx.priceFail);
        task.setReviewFailCount(ctx.reviewFail);
        task.setDuplicateCount(ctx.duplicate);
        task.setSkipCount(ctx.skipBlacklist + ctx.skipMain);
        task.setErrorMessage(truncateText(errorMessage, 1000));
        java.time.LocalDateTime failNow = java.time.LocalDateTime.now();
        task.setUpdatedAt(failNow);
        task.setCompletedAt(failNow);   // ERROR 也是终态，写入完成时间
        taskMapper.updateById(task);
    }

    /**
     * 执行 API 调用（异步，立即返回）
     * 互斥锁：同一时间只允许一个任务执行，避免重复 API 调用
     */
    @Async
    @Deprecated(forRemoval = true)
    public void executeApiCalls(Long taskId, String month) {
        rejectLegacyDirectExecution("ASIN 批处理");
        AsinImportTask task = taskMapper.selectById(taskId);
        if (task == null) {
            log.error("任务不存在: {}", taskId);
            return;
        }

        // ---- 悲观锁：同一类型+同一市场只允许一个任务执行 ----
        // 用 task.getImportType()（而非硬编码 ASIN），让文件导入与八爪鱼自动任务各自自锁，互不误伤
        Long activeCount = taskMapper.selectCount(
                new LambdaQueryWrapper<AsinImportTask>()
                        .eq(AsinImportTask::getImportType, task.getImportType())
                        .eq(AsinImportTask::getMarketplace, task.getMarketplace())
                        .in(AsinImportTask::getTaskStatus, List.of("RUNNING", "PAUSED")));
        if (activeCount != null && activeCount > 0) {
            LocalDateTime rejectedAt = LocalDateTime.now();
            task.setTaskStatus("REJECTED");
            task.setUpdatedAt(rejectedAt);
            task.setCompletedAt(rejectedAt);
            taskMapper.updateById(task);
            log.warn("任务 {} 被拒绝：已有活动中任务 (RUNNING/PAUSED 共: {})", taskId, activeCount);
            return;
        }

        try {
            task.setTaskStatus("RUNNING");
            task.setDataMonth(month);
            taskMapper.updateById(task);

            List<AsinImportResult> passResults = resultMapper.selectList(
                    new LambdaQueryWrapper<AsinImportResult>()
                            .eq(AsinImportResult::getTaskId, taskId)
                            .eq(AsinImportResult::getStatus, "PASS"));

            List<String> allAsins = new ArrayList<>();
            for (AsinImportResult r : passResults) allAsins.add(r.getAsin());

            int totalBatches = (allAsins.size() + BATCH_SIZE - 1) / BATCH_SIZE;
            int successCount = 0;
            int failCount = 0;
            int totalApiCalls = 0;
            int totalParentCount = 0;
            int totalVariantCount = 0;
            var batchTime = java.time.LocalDateTime.now();

            var logBuf = new StringBuilder();

            for (int i = 0; i < totalBatches; i++) {
                task = taskMapper.selectById(taskId);
                if ("PAUSED".equals(task.getTaskStatus()) || "CANCELLED".equals(task.getTaskStatus())) {
                    log.info("任务 {} 已被取消", taskId);
                    return;
                }

                int batchNo = i + 1;
                List<String> batch = allAsins.subList(i * BATCH_SIZE, Math.min((i + 1) * BATCH_SIZE, allAsins.size()));

                CompetitorLookupRequest req = new CompetitorLookupRequest();
                req.setMarketplace(task.getMarketplace());
                req.setAsins(new ArrayList<>(batch));
                req.setVariation("N");  // 含变体
                req.setSize(100);

                // Step 1: 调用 API（含限流等待提示）
                int remaining = rateLimitService.getMinuteRemaining();
                int maxPerMin = rateLimitService.getMaxPerMinute();
                if (remaining <= 0) {
                    long elapsedSec = rateLimitService.getMinuteWindowElapsedSeconds();
                    long waitSec = Math.max(1, 60 - elapsedSec + 1);
                    appendLog(logBuf, String.format(
                            "[%d/%d] 等待速率限制 (每分钟 %d 次, 预计等待 %ds)...",
                            batchNo, totalBatches, maxPerMin, waitSec));
                    task.setProgressLog(logBuf.toString());
                    taskMapper.updateById(task);
                }
                appendLog(logBuf, String.format("[%d/%d] 正在调用卖家精灵 API (marketplace=%s, asins=%d)...",
                        batchNo, totalBatches, task.getMarketplace(), batch.size()));
                task.setProgressLog(logBuf.toString());
                task.setBatchCurrent(batchNo);
                taskMapper.updateById(task);

                try {
                    var summary = competitorService.doLookupAndSave(req, month, batchTime);
                    int total = ((Number) summary.get("total")).intValue();
                    int mode1 = ((Number) summary.get("mode1")).intValue();
                    int mode2 = ((Number) summary.get("mode2")).intValue();
                    int fail = ((Number) summary.get("fail")).intValue();
                    int newProd = ((Number) summary.get("newProductPassed")).intValue();
                    int apiCalls = ((Number) summary.get("apiCalls")).intValue();
                    int parentCnt = ((Number) summary.get("parentAsinCount")).intValue();
                    int variantCnt = ((Number) summary.get("variantAsinCount")).intValue();
                    successCount += total;
                    totalApiCalls += apiCalls;
                    totalParentCount += parentCnt;
                    totalVariantCount += variantCnt;
                    appendLog(logBuf, String.format(
                            "[%d/%d] 入库 %d 条(%d页) | 父:%d 变体:%d | 模式一:%d 模式二:%d 淘汰:%d | 30天新品:%d",
                            batchNo, totalBatches, total, apiCalls, parentCnt, variantCnt,
                            mode1, mode2, fail, newProd));

                    // 请求过的 ASIN 写入 skip_asins，下次导入不再重复请求
                    List<SkipAsin> batchSkips = new ArrayList<>();
                    for (String asin : batch) {
                        SkipAsin s = new SkipAsin();
                        s.setAsin(asin);
                        s.setMarketplace(task.getMarketplace());
                        s.setFilterReasons("API已请求");
                        batchSkips.add(s);
                    }
                    skipAsinMapper.insertBatchIgnoreDup(batchSkips);
                } catch (Exception e) {
                    Throwable cause = e;
                    while (cause.getCause() != null) cause = cause.getCause();
                    String msg = cause.getMessage();
                    if (msg == null || msg.isEmpty()) msg = e.getMessage();
                    if (msg == null || msg.isEmpty()) msg = e.getClass().getSimpleName();
                    if (msg != null && msg.length() > 500) msg = msg.substring(0, 500);
                    log.error("批次 {} 失败: {}", batchNo, msg, e);
                    failCount += batch.size();
                    task.setErrorMessage("批次" + batchNo + ": " + (msg != null ? msg : "未知错误"));
                    appendLog(logBuf, String.format("[%d/%d] 失败: %s", batchNo, totalBatches,
                            msg != null ? msg : "未知错误"));
                    // 标记这批 ASIN 为 API_FAIL，后续可重试
                    markBatchApiFail(taskId, batch);
                }

                task.setBatchCurrent(batchNo);
                task.setApiSuccess(successCount);
                task.setApiFail(failCount);
                task.setProgressLog(logBuf.toString());
                taskMapper.updateById(task);

                // 批次间隔，避免触发卖家精灵频率限制
                if (i < totalBatches - 1) {
                    try { Thread.sleep(BATCH_API_DELAY_MS); } catch (InterruptedException ignored) {}
                }
            }

            LocalDateTime completedAt = LocalDateTime.now();
            task.setTaskStatus("DONE");
            task.setApiRequestsUsed(totalApiCalls);
            task.setParentAsinCount(totalParentCount);
            task.setVariantAsinCount(totalVariantCount);
            task.setUpdatedAt(completedAt);
            task.setCompletedAt(completedAt);
            taskMapper.updateById(task);
            log.info("任务 {} 执行完成。成功: {}, 失败: {}, API请求: {}, 父ASIN: {}, 变体: {}",
                    taskId, successCount, failCount, totalApiCalls, totalParentCount, totalVariantCount);

            // 导入完成 → 触发周标记 + 清洗层增量刷新（C-2 集成点）
            try {
                String weekTag = scoringService.updateWeekTags();
                Map<String, Object> cleanResult = cleanLayerService.cleanWeekBatch(task.getMarketplace(), weekTag);
                log.info("导入后清洗层刷新完成: taskId={}, marketplace={}, weekTag={}, affected={}",
                        taskId, task.getMarketplace(), weekTag, cleanResult.get("affectedRows"));
            } catch (Exception cleanEx) {
                log.error("导入后清洗层刷新失败（不影响主任务）: taskId={}, msg={}", taskId, cleanEx.getMessage(), cleanEx);
            }

        } catch (Exception e) {
            log.error("任务 {} 执行异常: {}", taskId, e.getMessage(), e);
            LocalDateTime failedAt = LocalDateTime.now();
            task.setTaskStatus("ERROR");
            task.setUpdatedAt(failedAt);
            task.setCompletedAt(failedAt);
            taskMapper.updateById(task);
        }
    }

    /**
     * 获取导入历史
     */
    public List<Map<String, Object>> getHistory() {
        List<AsinImportTask> tasks = taskMapper.selectList(
                new LambdaQueryWrapper<AsinImportTask>()
                        .orderByDesc(AsinImportTask::getId));
        List<Map<String, Object>> list = new ArrayList<>();
        for (AsinImportTask t : tasks) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", t.getId());
            item.put("marketplace", t.getMarketplace());
            item.put("importType", t.getImportType());
            item.put("status", t.getTaskStatus());
            item.put("totalCount", t.getTotalCount());
            item.put("passCount", t.getPassCount());
            item.put("priceFailCount", t.getPriceFailCount());
            item.put("reviewFailCount", t.getReviewFailCount());
            item.put("duplicateCount", t.getDuplicateCount());
            item.put("skipCount", t.getSkipCount());
            item.put("batchTotal", t.getBatchTotal());
            item.put("apiSuccess", t.getApiSuccess());
            item.put("apiFail", t.getApiFail());
            item.put("apiRequestsUsed", t.getApiRequestsUsed());
            item.put("parentAsinCount", t.getParentAsinCount());
            item.put("variantAsinCount", t.getVariantAsinCount());
            item.put("dataMonth", t.getDataMonth());
            item.put("createdAt", t.getCreatedAt());
            item.put("completedAt", t.getCompletedAt());
            list.add(item);
        }
        return list;
    }

    /** 标记 API 调用失败的 ASIN */
    private void markBatchApiFail(Long taskId, List<String> batchAsins) {
        try {
            AsinImportResult update = new AsinImportResult();
            update.setStatus("API_FAIL");
            update.setDetail("API调用异常，可重试");
            resultMapper.update(update,
                    new LambdaQueryWrapper<AsinImportResult>()
                            .eq(AsinImportResult::getTaskId, taskId)
                            .in(AsinImportResult::getAsin, batchAsins));
        } catch (Exception ignore) {
            log.warn("标记 API_FAIL 失败: {}", ignore.getMessage());
        }
    }

    /**
     * 获取任务的 ASIN 明细（按状态分组）
     */
    public Map<String, Object> getResults(Long taskId) {
        List<AsinImportResult> results = resultMapper.selectList(
                new LambdaQueryWrapper<AsinImportResult>()
                        .eq(AsinImportResult::getTaskId, taskId));

        Map<String, List<String>> byStatus = new LinkedHashMap<>();
        Map<String, Integer> counts = new LinkedHashMap<>();
        for (AsinImportResult r : results) {
            String status = r.getStatus() != null ? r.getStatus() : "UNKNOWN";
            byStatus.computeIfAbsent(status, k -> new ArrayList<>()).add(r.getAsin());
            counts.merge(status, 1, Integer::sum);
        }

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("taskId", taskId);
        data.put("total", results.size());
        data.put("byStatus", counts);
        // 返回全部失败 ASIN（去重合并：非 PASS 都是失败）
        List<String> failedAsins = new ArrayList<>();
        for (Map.Entry<String, List<String>> e : byStatus.entrySet()) {
            if (!"PASS".equals(e.getKey())) {
                failedAsins.addAll(e.getValue());
            }
        }
        data.put("failedCount", failedAsins.size());
        data.put("failedAsins", failedAsins);
        return data;
    }

    /**
     * 更新任务的 marketplace（执行前修正）
     */
    public void updateTaskMarketplace(Long taskId, String marketplace) {
        AsinImportTask task = taskMapper.selectById(taskId);
        if (task == null) throw new RuntimeException("任务不存在: " + taskId);
        if (!marketplace.equals(task.getMarketplace())) {
            log.info("任务 {} marketplace 由 {} 更新为 {}", taskId, task.getMarketplace(), marketplace);
            task.setMarketplace(marketplace);
            taskMapper.updateById(task);
        }
    }

    /**
     * 从失败 ASIN 创建新任务（去重已导入的）
     */
    public Map<String, Object> retryFailedAsins(Long taskId) {
        AsinImportTask oldTask = taskMapper.selectById(taskId);
        if (oldTask == null) throw new RuntimeException("任务不存在: " + taskId);

        // 只重试 API 调用失败的 ASIN（价格/评论淘汰、主表跳过等不应重试）
        List<AsinImportResult> failed = resultMapper.selectList(
                new LambdaQueryWrapper<AsinImportResult>()
                        .eq(AsinImportResult::getTaskId, taskId)
                        .eq(AsinImportResult::getStatus, "API_FAIL"));
        if (failed.isEmpty()) throw new RuntimeException("没有失败的 ASIN 需要重试");

        // 去重：排除已在 competitor_products 中的 ASIN
        Set<String> allFailed = new LinkedHashSet<>();
        for (AsinImportResult r : failed) allFailed.add(r.getAsin());
        Set<String> alreadyImported = competitorProductMapper.selectList(
                        new LambdaQueryWrapper<CompetitorProduct>()
                                .select(CompetitorProduct::getAsin)
                                .in(CompetitorProduct::getAsin, allFailed)
                                .groupBy(CompetitorProduct::getAsin))
                .stream().map(CompetitorProduct::getAsin).collect(java.util.stream.Collectors.toSet());
        allFailed.removeAll(alreadyImported);

        if (allFailed.isEmpty()) throw new RuntimeException("所有失败的 ASIN 已被导入，无需重试");

        // 创建新任务
        AsinImportTask newTask = new AsinImportTask();
        newTask.setMarketplace(oldTask.getMarketplace());
        newTask.setImportType(oldTask.getImportType() != null ? oldTask.getImportType() : "ASIN");
        newTask.setTaskStatus("READY");
        newTask.setTotalCount(allFailed.size());
        newTask.setPassCount(allFailed.size());
        LocalDateTime createdAt = LocalDateTime.now();
        newTask.setCreatedAt(createdAt);
        newTask.setUpdatedAt(createdAt);
        newTask.setCompletedAt(createdAt);
        taskMapper.insert(newTask);

        // 保存为 PASS 结果
        for (String asin : allFailed) {
            AsinImportResult r = new AsinImportResult();
            r.setTaskId(newTask.getId());
            r.setAsin(asin);
            r.setStatus("PASS");
            resultMapper.insert(r);
        }

        // 计算批次数
        int totalBatches = (allFailed.size() + BATCH_SIZE - 1) / BATCH_SIZE;
        newTask.setBatchTotal(totalBatches);
        newTask.setBatchCurrent(0);
        taskMapper.updateById(newTask);

        log.info("重试任务 {}: 原始失败 {}, 已去重 {}, 新任务 {} ({} 批)",
                taskId, failed.size(), alreadyImported.size(), newTask.getId(), totalBatches);

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("newTaskId", newTask.getId());
        data.put("total", allFailed.size());
        data.put("duplicatesRemoved", alreadyImported.size());
        data.put("batches", totalBatches);
        return data;
    }

    /**
     * 取消任务（暂停或停止）
     */
    public void cancelTask(Long taskId, String action) {
        AsinImportTask task = taskMapper.selectById(taskId);
        if (task == null) throw new RuntimeException("任务不存在: " + taskId);

        if ("pause".equals(action)) {
            task.setTaskStatus("PAUSED");
        } else {
            LocalDateTime cancelledAt = LocalDateTime.now();
            task.setTaskStatus("CANCELLED");
            task.setUpdatedAt(cancelledAt);
            task.setCompletedAt(cancelledAt);
        }
        taskMapper.updateById(task);
        log.info("任务 {} 已{}", taskId, "pause".equals(action) ? "暂停" : "取消");
    }

    /**
     * 查询任务进度
     */
    public Map<String, Object> getProgress(Long taskId) {
        AsinImportTask task = taskMapper.selectById(taskId);
        if (task == null) throw new RuntimeException("任务不存在: " + taskId);

        Map<String, Object> progress = new HashMap<>();
        progress.put("taskId", task.getId());
        progress.put("status", task.getTaskStatus());
        progress.put("totalCount", task.getTotalCount());
        progress.put("passCount", task.getPassCount());
        progress.put("batchTotal", task.getBatchTotal());
        progress.put("batchCurrent", task.getBatchCurrent());
        progress.put("apiSuccess", task.getApiSuccess());
        progress.put("apiFail", task.getApiFail());
        progress.put("errorMessage", task.getErrorMessage() != null ? task.getErrorMessage() : "");
        progress.put("progressLog", task.getProgressLog() != null ? task.getProgressLog() : "");
        return progress;
    }

    /**
     * 获取任务实体（供 Controller 使用）
     */
    public AsinImportTask getTaskById(Long taskId) {
        return taskMapper.selectById(taskId);
    }

    /**
     * 卖家名批量导入 - 预览
     */
    public Map<String, Object> sellerPreview(List<String> sellerNames, String marketplace, String target) {
        return workloadGate.runHeavyWrite(() -> doSellerPreview(sellerNames, marketplace, target));
    }

    /** 删除八爪鱼导入任务及其明细，释放该批次的幂等记录以便重新导入。 */
    @Transactional
    public void deleteBazhuayuTask(Long taskId) {
        AsinImportTask task = taskMapper.selectById(taskId);
        if (task == null) {
            throw new IllegalArgumentException("导入任务不存在: " + taskId);
        }
        if (!"BAZHUAYU_AUTO".equals(task.getImportType())) {
            throw new IllegalArgumentException("只能删除八爪鱼导入任务");
        }
        if ("RUNNING".equalsIgnoreCase(task.getTaskStatus())) {
            throw new IllegalStateException("任务正在运行，请等待完成后再删除");
        }
        List<String> asins = resultMapper.selectList(new LambdaQueryWrapper<AsinImportResult>()
                        .select(AsinImportResult::getAsin)
                        .eq(AsinImportResult::getTaskId, taskId)
                        .isNotNull(AsinImportResult::getAsin))
                .stream().map(AsinImportResult::getAsin).filter(Objects::nonNull)
                .distinct().toList();
        forEachAsinChunk(asins, chunk -> {
            skipAsinMapper.delete(new LambdaQueryWrapper<SkipAsin>()
                    .eq(SkipAsin::getMarketplace, task.getMarketplace())
                    .in(SkipAsin::getAsin, chunk));
            bazhuayuWeeklyRawMapper.delete(new LambdaQueryWrapper<BazhuayuWeeklyRaw>()
                    .eq(BazhuayuWeeklyRaw::getMarketplace, task.getMarketplace())
                    .in(BazhuayuWeeklyRaw::getAsin, chunk));
            if ("premium_products".equals(task.getTargetTable())) {
                LambdaQueryWrapper<PremiumProduct> premium = new LambdaQueryWrapper<PremiumProduct>()
                        .eq(PremiumProduct::getMarketplace, task.getMarketplace())
                        .in(PremiumProduct::getAsin, chunk);
                if (task.getBazhuayuMappingId() != null) {
                    premium.eq(PremiumProduct::getBazhuayuMappingId, task.getBazhuayuMappingId());
                }
                premiumProductMapper.delete(premium);
            }
        });
        resultMapper.delete(new LambdaQueryWrapper<AsinImportResult>()
                .eq(AsinImportResult::getTaskId, taskId));
        taskMapper.deleteById(taskId);
        log.info("八爪鱼导入任务已删除: taskId={}, batchNo={}", taskId, task.getBazhuayuBatchNo());
    }

    private void forEachAsinChunk(List<String> asins, java.util.function.Consumer<List<String>> action) {
        for (int from = 0; from < asins.size(); from += 1000) {
            action.accept(asins.subList(from, Math.min(from + 1000, asins.size())));
        }
    }

    private Map<String, Object> doSellerPreview(List<String> sellerNames, String marketplace, String target) {
        List<String> cleaned = sellerNames.stream()
                .map(String::trim)
                .filter(name -> !name.isEmpty())
                .distinct()
                .collect(java.util.stream.Collectors.toList());

        if (cleaned.isEmpty()) {
            throw new RuntimeException("没有有效的卖家名");
        }

        int maxPerMin = rateLimitService.getMaxPerMinute();
        int estimatedPagesPerSeller = 3;
        int estimatedApiCalls = cleaned.size() * estimatedPagesPerSeller;
        int estimatedDurationSec = Math.max(1, (int) Math.ceil((double) estimatedApiCalls / maxPerMin * 60));

        AsinImportTask task = new AsinImportTask();
        task.setMarketplace(marketplace);
        task.setImportType("SELLER_" + target.toUpperCase());
        task.setTaskStatus("READY");
        task.setTotalCount(cleaned.size());
        task.setPassCount(cleaned.size());
        task.setBatchTotal(cleaned.size());
        task.setBatchCurrent(0);
        LocalDateTime createdAt = LocalDateTime.now();
        task.setCreatedAt(createdAt);
        task.setUpdatedAt(createdAt);
        task.setCompletedAt(createdAt);
        taskMapper.insert(task);

        List<AsinImportResult> results = new ArrayList<>();
        for (String sellerName : cleaned) {
            AsinImportResult r = new AsinImportResult();
            r.setTaskId(task.getId());
            r.setAsin(null);
            r.setSellerName(sellerName);
            r.setStatus("PASS");
            results.add(r);
        }
        
        resultMapper.insertBatch(results);

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("taskId", task.getId());
        data.put("sellerCount", cleaned.size());
        data.put("estimatedApiCalls", estimatedApiCalls);
        data.put("marketplace", marketplace);
        data.put("maxPerMinute", maxPerMin);
        data.put("delayMs", (int) SELLER_API_DELAY_MS);
        data.put("estimatedDuration", estimatedDurationSec);
        return data;
    }

    /**
     * 卖家名批量导入 - 执行（异步）
     */
    @Async("sellerImportExecutor")
    @Deprecated(forRemoval = true)
    public void sellerExecute(Long taskId, String month, String target) {
        rejectLegacyDirectExecution("卖家名批处理");
        AsinImportTask task = taskMapper.selectById(taskId);
        if (task == null) {
            log.error("卖家导入任务不存在: {}", taskId);
            return;
        }

        Long activeCount = taskMapper.selectCount(
                new LambdaQueryWrapper<AsinImportTask>()
                        .eq(AsinImportTask::getImportType, "SELLER_" + target.toUpperCase())
                        .eq(AsinImportTask::getMarketplace, task.getMarketplace())
                        .in(AsinImportTask::getTaskStatus, List.of("RUNNING", "PAUSED")));
        if (activeCount != null && activeCount > 0) {
            LocalDateTime rejectedAt = LocalDateTime.now();
            task.setTaskStatus("REJECTED");
            task.setUpdatedAt(rejectedAt);
            task.setCompletedAt(rejectedAt);
            taskMapper.updateById(task);
            log.warn("卖家导入任务 {} 被拒绝：同市场已有活动中任务", taskId);
            return;
        }

        try {
            task.setTaskStatus("RUNNING");
            task.setDataMonth(month);
            taskMapper.updateById(task);

            List<AsinImportResult> results = resultMapper.selectList(
                    new LambdaQueryWrapper<AsinImportResult>()
                            .eq(AsinImportResult::getTaskId, taskId)
                            .eq(AsinImportResult::getStatus, "PASS"));

            int totalSellers = results.size();
            int totalProducts = 0;
            int totalApiCalls = 0;
            StringBuilder logBuf = new StringBuilder();

            boolean isDengZong = "deng_zong_shop".equals(target);

            for (int i = 0; i < results.size(); i++) {
                AsinImportResult r = results.get(i);

                if (i % STATUS_CHECK_INTERVAL == 0) {
                    task = taskMapper.selectById(taskId);
                    if ("PAUSED".equals(task.getTaskStatus()) || "CANCELLED".equals(task.getTaskStatus())) {
                        log.info("卖家导入任务 {} 已被暂停或取消", taskId);
                        return;
                    }
                }

                int currentSeller = i + 1;
                String sellerName = r.getSellerName();

                appendLog(logBuf, String.format("[%d/%d] 正在获取店铺: %s",
                        currentSeller, totalSellers, sellerName));

                try {
                    int count;
                    int apiCalls;
                    if (isDengZong) {
                        Map<String, Object> syncResult = dengZongShopService.syncBySellerName(sellerName, task.getMarketplace());
                        count = ((Number) syncResult.getOrDefault("inserted", 0)).intValue();
                        apiCalls = ((Number) syncResult.getOrDefault("apiCalls", 0)).intValue();
                    } else {
                        SellerSyncResult syncResult = syncProductsBySeller(sellerName, task.getMarketplace(), month);
                        count = syncResult.products();
                        apiCalls = syncResult.apiCalls();
                    }
                    totalProducts += count;
                    totalApiCalls += apiCalls;
                    appendLog(logBuf, String.format("[%d/%d] %s: 获取 %d 个产品",
                            currentSeller, totalSellers, sellerName, count));

                    r.setStatus("SUCCESS");
                    r.setDetail("获取 " + count + " 个产品");
                    resultMapper.updateById(r);
                } catch (Exception e) {
                    log.error("卖家 {} 同步失败: {}", sellerName, e.getMessage());
                    appendLog(logBuf, String.format("[%d/%d] %s: 失败 - %s",
                            currentSeller, totalSellers, sellerName, e.getMessage()));
                    r.setStatus("API_FAIL");
                    r.setDetail(e.getMessage());
                    resultMapper.updateById(r);
                }

                task.setProgressLog(logBuf.toString());
                task.setBatchCurrent(currentSeller);
                task.setApiSuccess(totalProducts);
                task.setApiRequestsUsed(totalApiCalls);
                taskMapper.updateById(task);

                try { Thread.sleep(SELLER_API_DELAY_MS); } catch (InterruptedException ignored) {}
            }

            LocalDateTime completedAt = LocalDateTime.now();
            task.setTaskStatus("DONE");
            task.setUpdatedAt(completedAt);
            task.setCompletedAt(completedAt);
            taskMapper.updateById(task);
            log.info("卖家导入完成: taskId={}, sellers={}, products={}", taskId, totalSellers, totalProducts);

            // 导入完成 → 触发周标记 + 清洗层增量刷新（C-2 集成点）
            try {
                String weekTag = scoringService.updateWeekTags();
                Map<String, Object> cleanResult = cleanLayerService.cleanWeekBatch(task.getMarketplace(), weekTag);
                log.info("导入后清洗层刷新完成: taskId={}, marketplace={}, weekTag={}, affected={}",
                        taskId, task.getMarketplace(), weekTag, cleanResult.get("affectedRows"));
            } catch (Exception cleanEx) {
                // 清洗失败不影响主任务标记 DONE；下次手动调 /api/v1/clean-layer/refresh-week-batch 补救
                log.error("导入后清洗层刷新失败（不影响主任务）: taskId={}, msg={}", taskId, cleanEx.getMessage(), cleanEx);
            }
        } catch (Exception e) {
            log.error("卖家导入异常: {}", e.getMessage(), e);
            LocalDateTime failedAt = LocalDateTime.now();
            task.setTaskStatus("ERROR");
            task.setErrorMessage(e.getMessage());
            task.setUpdatedAt(failedAt);
            task.setCompletedAt(failedAt);
            taskMapper.updateById(task);
        }
    }

    /** 
     * 调用卖家精灵 API 按店铺名获取产品并写入 competitor_products
     * 注意：@Transactional 在 private 方法上不生效（Spring AOP 限制），
     * 事务由调用方 sellerExecute 中的 competitorService.upsertAndFilter 内部保证
     */
    private SellerSyncResult syncProductsBySeller(String sellerName, String marketplace, String month) {
        List<CompetitorProduct> batch = new ArrayList<>();
        int apiCalls = 0;
        int page = 1;

        while (true) {
            JsonNode data = callSellerspriteApi(sellerName, marketplace, page, 100, month);
            apiCalls++;
            if (data == null) break;

            int apiTotal = data.path("total").asInt(0);
            JsonNode items = data.path("items");
            if (items == null || !items.isArray() || items.isEmpty()) break;

            for (JsonNode item : items) {
                try {
                    CompetitorProduct product = mapSellerItemToProduct(item, marketplace, month);
                    if (product.getAsin() != null) {
                        batch.add(product);
                    }
                } catch (Exception e) {
                    log.warn("映射产品失败: asin={}, error={}",
                            item.path("asin").asText(), e.getMessage());
                }
            }

            if (batch.size() >= apiTotal) break;
            page++;
            try { Thread.sleep(300); } catch (InterruptedException ignored) {}
        }

        if (!batch.isEmpty()) {
            competitorService.upsertAndFilter(batch, marketplace, "竞品店铺", month);
        }

        // 更新卖家最后同步时间
        LambdaQueryWrapper<DengZongShopSeller> sellerQw = new LambdaQueryWrapper<>();
        sellerQw.eq(DengZongShopSeller::getMarketplace, marketplace)
                .eq(DengZongShopSeller::getSellerName, sellerName);
        DengZongShopSeller seller = sellerMapper.selectOne(sellerQw);
        if (seller != null) {
            seller.setLastSyncedAt(LocalDateTime.now());
            sellerMapper.updateById(seller);
        }

        return new SellerSyncResult(batch.size(), apiCalls);
    }

    private JsonNode callSellerspriteApi(String sellerName, String marketplace, int page, int size, String month) {
        CompetitorLookupRequest request = new CompetitorLookupRequest();
        request.setMarketplace(marketplace);
        request.setMonth(month);
        request.setSellerName(sellerName);
        request.setAsins(List.of());
        request.setVariation("N");
        request.setPage(page);
        request.setSize(size);
        request.setOrderDesc(true);
        String scope = "marketplace=" + marketplace + ", seller=" + sellerName + ", page=" + page;
        return executionGateway.execute(new SellerspriteExecutionRequest(request,
                SellerspriteExecutionContext.legacy("SELLER_BATCH_LOOKUP", scope))).data();
    }

    private record SellerSyncResult(int products, int apiCalls) {}

    private CompetitorProduct mapSellerItemToProduct(JsonNode item, String marketplace, String month) {
        CompetitorProduct cp = new CompetitorProduct();
        cp.setMarketplace(marketplace);
        cp.setAsin(item.path("asin").asText(null));
        cp.setMonth(month);
        cp.setTitle(item.path("title").asText(null));
        cp.setBrand(item.path("brand").asText(null));
        cp.setBrandUrl(item.path("brandUrl").asText(null));
        cp.setImageUrl(item.path("imageUrl").asText(null));
        cp.setParentAsin(item.path("parent").asText(item.path("parentAsin").asText(null)));
        cp.setSku(item.path("sku").asText(null));
        if (item.path("nodeId").isNumber()) cp.setNodeId(item.path("nodeId").longValue());
        cp.setNodeIdPath(item.path("nodeIdPath").asText(null));
        cp.setNodeLabelPath(item.path("nodeLabelPath").asText(null));
        cp.setSymbol(item.path("symbol").asText(null));
        if (item.path("units").isNumber()) cp.setUnits(item.path("units").intValue());
        cp.setUnitsGr(parseBigDecimal(item, "unitsGr"));
        if (item.path("amzUnit").isNumber()) cp.setAmzUnit(item.path("amzUnit").intValue());
        cp.setAmzSales(parseBigDecimal(item, "amzSales"));
        cp.setRevenue(parseBigDecimal(item, "revenue"));
        cp.setBsrId(item.path("bsrId").asText(null));
        if (item.path("bsr").isNumber()) cp.setBsr(item.path("bsr").intValue());
        cp.setBsrCr(parseBigDecimal(item, "bsrCr"));
        if (item.path("bsrCv").isNumber()) cp.setBsrCv(item.path("bsrCv").intValue());
        if (item.path("ratings").isNumber()) cp.setRatings(item.path("ratings").intValue());
        cp.setRating(parseBigDecimal(item, "rating"));
        cp.setRatingsRate(parseBigDecimal(item, "ratingsRate"));
        if (item.path("ratingsCv").isNumber()) cp.setRatingsCv(item.path("ratingsCv").intValue());
        if (item.path("ratingDelta").isNumber()) cp.setRatingDelta(item.path("ratingDelta").intValue());
        cp.setPrice(parseBigDecimal(item, "price"));
        cp.setPrimePrice(parseBigDecimal(item, "primePrice"));
        cp.setProfit(parseBigDecimal(item, "profit"));
        cp.setFba(parseBigDecimal(item, "fba"));
        cp.setDeliveryPrice(parseBigDecimal(item, "deliveryPrice"));
        cp.setSellerName(item.path("sellerName").asText(null));
        cp.setSellerId(item.path("sellerId").asText(null));
        cp.setSellerNation(item.path("sellerNation").asText(null));
        if (item.path("sellers").isNumber()) cp.setSellers(item.path("sellers").intValue());
        cp.setFulfillment(item.path("fulfillment").asText(null));
        if (item.path("variations").isNumber()) cp.setVariations(item.path("variations").intValue());
        cp.setWeight(item.path("weight").asText(null));
        cp.setDimension(item.path("dimension").asText(null));
        cp.setProductUrl(item.path("productUrl").asText(null));
        cp.setSimilarUrl(item.path("similarUrl").asText(null));
        cp.setSource(item.path("source").asText(null));
        if (item.path("availableDate").isNumber()) cp.setAvailableDate(item.path("availableDate").longValue());
        cp.setIsCurrent(1);
        cp.setCreatedAt(LocalDateTime.now());
        cp.setUpdatedAt(LocalDateTime.now());
        return cp;
    }

    private BigDecimal parseBigDecimal(JsonNode node, String field) {
        JsonNode v = node.path(field);
        if (v.isNumber()) return v.decimalValue();
        if (v.isTextual()) {
            try { return new BigDecimal(v.asText().replace("%", "")); } catch (Exception ignored) {}
        }
        return null;
    }

    private static final int MAX_LOG_LINES = 50;

    private void appendLog(StringBuilder sb, String line) {
        sb.append(line).append("\n");
        // 截断：只保留最近 MAX_LOG_LINES 行
        int lineCount = 0;
        for (int i = sb.length() - 1; i >= 0; i--) {
            if (sb.charAt(i) == '\n') lineCount++;
            if (lineCount >= MAX_LOG_LINES) {
                sb.delete(0, i + 1);
                break;
            }
        }
    }

    // ---- 文件解析 ----

    private List<Map<String, String>> parseExcel(MultipartFile file) throws Exception {
        List<Map<String, String>> rows = new ArrayList<>();
        try (InputStream is = file.getInputStream(); Workbook wb = new XSSFWorkbook(is)) {
            Sheet sheet = wb.getSheetAt(0);
            Row headerRow = sheet.getRow(0);
            if (headerRow == null) return rows;

            // 构建列映射（LinkedHashMap 保证列顺序与索引一致）
            Map<Integer, String> colMap = new LinkedHashMap<>();
            for (int i = 0; i < headerRow.getLastCellNum(); i++) {
                Cell cell = headerRow.getCell(i);
                if (cell != null) {
                    colMap.put(i, cell.toString().trim());
                }
            }
            log.info("Excel 列头: {}", colMap);

            for (int r = 1; r <= sheet.getLastRowNum(); r++) {
                Row row = sheet.getRow(r);
                if (row == null) continue;
                Map<String, String> record = new LinkedHashMap<>();
                for (Map.Entry<Integer, String> entry : colMap.entrySet()) {
                    Cell cell = row.getCell(entry.getKey());
                    record.put(entry.getValue(), cell != null ? cell.toString().trim() : "");
                }
                if (!record.isEmpty()) rows.add(record);
            }
        }
        return rows;
    }

    private List<Map<String, String>> parseJson(MultipartFile file) throws Exception {
        String content = new String(file.getBytes(), "UTF-8");
        return objectMapper.readValue(content, new TypeReference<List<Map<String, String>>>() {});
    }

    // ---- 筛选逻辑 ----

    private Map<String, List<Map<String, String>>> filterRows(List<Map<String, String>> rows,
                                                              Set<String> blacklistAsins,
                                                              Set<String> mainTableAsins,
                                                              String marketplace) {
        Map<String, List<Map<String, String>>> result = new LinkedHashMap<>();
        result.put("PASS", new ArrayList<>());
        result.put("PRICE_FAIL", new ArrayList<>());
        result.put("REVIEW_FAIL", new ArrayList<>());
        result.put("DUPLICATE", new ArrayList<>());
        result.put("SKIP_BLACKLIST", new ArrayList<>());
        result.put("SKIP_MAIN", new ArrayList<>());

        Set<String> seen = new HashSet<>();
        // 调试：打印第一条数据的所有 key=value
        if (!rows.isEmpty()) {
            log.info("数据列名: {}", rows.get(0).keySet());
            Map<String, String> first = rows.get(0);
            for (Map.Entry<String, String> e : first.entrySet()) {
                log.info("  [{}] = '{}'", e.getKey(), e.getValue());
            }
        }

        int rowIdx = 0;
        for (Map<String, String> row : rows) {
            rowIdx++;
            String asin = findAsin(row);
            if (asin == null || asin.isEmpty()) continue;

            // ASIN 格式校验
            if (!asin.matches("^B0[0-9A-Z]{8}$")) continue;

            // 内部去重
            if (seen.contains(asin)) {
                Map<String, String> dup = new LinkedHashMap<>(row);
                dup.put("asin", asin);
                result.get("DUPLICATE").add(dup);
                continue;
            }
            seen.add(asin);

            // ★ 跳过检查必须在价格/评论之前：只要请求过的ASIN，绝对不重复
            // 硬性黑名单（历史淘汰：价格/评论/精筛不通过）
            if (blacklistAsins.contains(asin)) {
                Map<String, String> skip = new LinkedHashMap<>(row);
                skip.put("asin", asin);
                result.get("SKIP_BLACKLIST").add(skip);
                continue;
            }

            // 主表已有（曾经请求过API，无论精筛通过与否）
            if (mainTableAsins.contains(asin)) {
                Map<String, String> skip = new LinkedHashMap<>(row);
                skip.put("asin", asin);
                result.get("SKIP_MAIN").add(skip);
                continue;
            }

            // 价格筛选：优先按索引（Python: PRICE_COL_INDEX=3），列名回退
            String priceStr = getByIndex(row, 3);
            if (priceStr == null || priceStr.isEmpty()) priceStr = findField(row, "价格(£)", "价格", "price", "Price", "售价");
            // 排除人民币定价（CNY/¥ 出现在欧洲站是跨境错误上架）
            if (priceStr != null && (priceStr.contains("CNY") || priceStr.contains("¥") || priceStr.contains("￥"))) {
                Map<String, String> fail = new LinkedHashMap<>(row);
                fail.put("asin", asin);
                fail.put("_price", priceStr);
                fail.put("_detail", "人民币定价");
                result.get("PRICE_FAIL").add(fail);
                continue;
            }
            Double price = null;
            if (priceStr != null && !priceStr.isEmpty()) {
                price = extractNumeric(priceStr);
            }
            if (rowIdx <= 3) log.info("  ASIN={} priceIdx[3]='{}' extractNumeric={}", asin, getByIndex(row, 3), price);
            if (price != null && (price < initialFilterConfig.getPriceMin(marketplace).doubleValue() || price > initialFilterConfig.getPriceMax(marketplace).doubleValue())) {
                Map<String, String> fail = new LinkedHashMap<>(row);
                fail.put("asin", asin);
                fail.put("_price", String.valueOf(price));
                result.get("PRICE_FAIL").add(fail);
                continue;
            }

            // 评论数筛选：优先按索引（Python: REVIEW_COL_INDEX=4），列名回退
            String reviewStr = getByIndex(row, 4);
            if (reviewStr == null || reviewStr.isEmpty()) reviewStr = findField(row, "review数量", "评论数量", "review_count", "reviews", "评论", "review");
            Integer reviews = null;
            if (reviewStr != null && !reviewStr.isEmpty()) {
                try { reviews = Integer.parseInt(reviewStr.replaceAll("[^0-9]", "")); } catch (Exception ignored) {}
            }
            if (rowIdx <= 3) log.info("  ASIN={} reviewIdx[4]='{}' parseReview={}", asin, getByIndex(row, 4), reviews);
            if (reviews != null && reviews > initialFilterConfig.getReviewMax(marketplace)) {
                Map<String, String> fail = new LinkedHashMap<>(row);
                fail.put("asin", asin);
                fail.put("_reviews", String.valueOf(reviews));
                result.get("REVIEW_FAIL").add(fail);
                continue;
            }

            // 通过
            if (rowIdx <= 10) log.info("  ASIN={} PASS (price={}, reviews={})", asin, price, reviews);
            Map<String, String> pass = new LinkedHashMap<>(row);
            pass.put("asin", asin);
            result.get("PASS").add(pass);
        }

        return result;
    }

    private void saveResults(Long taskId, Map<String, List<Map<String, String>>> filterResult, String marketplace) {
        List<AsinImportResult> batch = new ArrayList<>(DB_BATCH_SIZE);
        for (Map.Entry<String, List<Map<String, String>>> entry : filterResult.entrySet()) {
            String status = entry.getKey();
            for (Map<String, String> row : entry.getValue()) {
                AsinImportResult result = new AsinImportResult();
                result.setTaskId(taskId);
                result.setAsin(row.get("asin"));
                result.setTitle(truncateText(row.get("标题"), RESULT_TITLE_MAX_LENGTH));
                result.setStatus(status);
                switch (status) {
                    case "PRICE_FAIL" -> result.setDetail("价格 " + row.get("_price") + " 不在范围 " + initialFilterConfig.getPriceMin(marketplace) + "-" + initialFilterConfig.getPriceMax(marketplace));
                    case "REVIEW_FAIL" -> result.setDetail("评论数 " + row.get("_reviews") + " > " + initialFilterConfig.getReviewMax(marketplace));
                    case "DUPLICATE" -> result.setDetail("文件内重复");
                    case "SKIP_BLACKLIST" -> result.setDetail("硬性淘汰黑名单");
                    case "SKIP_MAIN" -> result.setDetail("主表已有数据");
                }
                batch.add(result);
                if (batch.size() >= DB_BATCH_SIZE) {
                    Db.saveBatch(batch, DB_BATCH_SIZE);
                    batch.clear();
                }
            }
        }
        if (!batch.isEmpty()) {
            Db.saveBatch(batch, batch.size());
        }
        log.info("筛选结果已保存: {} 条", filterResult.values().stream().mapToInt(List::size).sum());
    }

    /** 从输入文件行中提取所有 ASIN（不做去重，后续由 filterRows 处理） */
    private Set<String> extractInputAsins(List<Map<String, String>> rows) {
        Set<String> asins = new HashSet<>();
        for (Map<String, String> row : rows) {
            String asin = findAsin(row);
            if (asin != null && asin.matches("^B0[0-9A-Z]{8}$")) {
                asins.add(asin);
            }
        }
        return asins;
    }

    /** 分批查询输入 ASIN 中哪些已存在于 skip_asins 表 */
    private Set<String> batchQueryExistingBlacklist(Set<String> inputAsins, String marketplace) {
        Set<String> found = new HashSet<>();
        List<String> asinList = new ArrayList<>(inputAsins);
        for (int i = 0; i < asinList.size(); i += DB_BATCH_SIZE) {
            int end = Math.min(i + DB_BATCH_SIZE, asinList.size());
            List<String> batch = asinList.subList(i, end);
            found.addAll(skipAsinMapper.selectExistingAsinsInList(marketplace, batch));
        }
        return found;
    }

    /** 分批查询输入 ASIN 中哪些已存在于 competitor_products 表（asin 或 parent_asin） */
    private Set<String> batchQueryExistingMainTable(Set<String> inputAsins, String marketplace) {
        Set<String> found = new HashSet<>();
        List<String> asinList = new ArrayList<>(inputAsins);
        for (int i = 0; i < asinList.size(); i += DB_BATCH_SIZE) {
            int end = Math.min(i + DB_BATCH_SIZE, asinList.size());
            List<String> batch = asinList.subList(i, end);
            found.addAll(competitorProductMapper.selectExistingAsinsInList(marketplace, batch));
        }
        return found;
    }

    /**
     * 将初筛不通过的 ASIN 写入 skip_asins 表（后续上传可去重）
     */
    private void saveFilteredAsinsToSkipTable(Map<String, List<Map<String, String>>> filterResult, String marketplace) {
        List<SkipAsin> allSkips = new ArrayList<>();
        // 收集所有需要跳过的 ASIN
        for (Map<String, String> row : filterResult.getOrDefault("PRICE_FAIL", List.of())) {
            String priceInfo = row.get("_price");
            row.put("_detail", "初筛: 价格" + (priceInfo != null ? priceInfo : "?") + " 不在 " + initialFilterConfig.getPriceMin(marketplace) + "~" + initialFilterConfig.getPriceMax(marketplace) + " 范围");
            collectSkipAsinFromRow(row, marketplace, allSkips);
        }
        for (Map<String, String> row : filterResult.getOrDefault("REVIEW_FAIL", List.of())) {
            String reviewInfo = row.get("_reviews");
            row.put("_detail", "初筛: 评论数" + (reviewInfo != null ? reviewInfo : "?") + " > " + initialFilterConfig.getReviewMax(marketplace));
            collectSkipAsinFromRow(row, marketplace, allSkips);
        }
        for (Map<String, String> row : filterResult.getOrDefault("SKIP_MAIN", List.of())) {
            row.put("_detail", "主表已有（competitor_products）");
            collectSkipAsinFromRow(row, marketplace, allSkips);
        }
        for (Map<String, String> row : filterResult.getOrDefault("DUPLICATE", List.of())) {
            row.put("_detail", "文件内重复");
            collectSkipAsinFromRow(row, marketplace, allSkips);
        }

        if (!allSkips.isEmpty()) {
            // 分批 INSERT IGNORE（唯一键冲突静默跳过）
            for (int i = 0; i < allSkips.size(); i += DB_BATCH_SIZE) {
                int end = Math.min(i + DB_BATCH_SIZE, allSkips.size());
                skipAsinMapper.insertBatchIgnoreDup(allSkips.subList(i, end));
            }
            log.info("初筛淘汰写入 skip_asins: {} 条", allSkips.size());
        }
    }

    private void collectSkipAsinFromRow(Map<String, String> row, String marketplace, List<SkipAsin> collector) {
        String asin = row.get("asin");
        if (asin == null || asin.isEmpty()) return;
        SkipAsin skip = new SkipAsin();
        skip.setAsin(asin);
        skip.setMarketplace(marketplace);
        skip.setFilterReasons(row.getOrDefault("_detail", "初筛淘汰"));
        skip.setTitle(row.get("标题"));
        skip.setPrice(parsePrice(row.get("_price")));
        collector.add(skip);
    }

    private BigDecimal parsePrice(String priceStr) {
        if (priceStr == null) return null;
        try { return new BigDecimal(priceStr); } catch (Exception e) { return null; }
    }

    private String truncateText(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) return value;
        return value.substring(0, maxLength);
    }

    /**
     * 旧执行器下线门禁：所有卖家精灵请求必须由请求中心创建 run 后消费。
     * 保留旧方法签名仅为二进制兼容；任何绕过 Controller 的调用都会被明确拒绝。
     */
    private void rejectLegacyDirectExecution(String operation) {
        throw new UnsupportedOperationException(operation + " 已迁移到卖家精灵请求中心，请创建 runId 后查看执行进度");
    }

    // ---- 工具方法 ----

    private String findAsin(Map<String, String> row) {
        // 优先索引定位（LinkedHashMap 保证顺序），列名作为回退
        String asin = getByIndex(row, 1);
        if (asin == null || asin.isEmpty()) asin = findField(row, "ASIN", "asin", "Asin", "产品ASIN");
        return asin;
    }

    private String findField(Map<String, String> row, String... keys) {
        for (String key : keys) {
            // 精确匹配
            String val = row.get(key);
            if (val != null && !val.isEmpty()) return val.trim();
            // 模糊匹配：key 包含在列名中
            for (Map.Entry<String, String> e : row.entrySet()) {
                if (e.getKey().contains(key) && e.getValue() != null && !e.getValue().isEmpty()) {
                    return e.getValue().trim();
                }
            }
        }
        // 索引回退：遍历所有 key，找第一个非空值
        // 这个用于 row 中没有列名只有索引的情况
        return null;
    }

    /** 按列索引取值（0-based），匹配 Python 脚本逻辑 */
    private String getByIndex(Map<String, String> row, int index) {
        int i = 0;
        for (String val : row.values()) {
            if (i == index && val != null && !val.isEmpty()) return val.trim();
            i++;
        }
        return null;
    }

    private Double extractNumeric(String text) {
        if (text == null) return null;
        Matcher m = PRICE_PATTERN.matcher(text);
        if (m.find()) {
            try { return Double.parseDouble(m.group(1)); } catch (NumberFormatException ignored) {}
        }
        return null;
    }
}
