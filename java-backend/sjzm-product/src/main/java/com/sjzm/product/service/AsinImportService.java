package com.sjzm.product.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.toolkit.Db;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sjzm.product.config.SellerspriteConfig;
import com.sjzm.product.dto.CompetitorLookupRequest;
import com.sjzm.product.entity.AsinImportResult;
import com.sjzm.product.entity.AsinImportTask;
import com.sjzm.product.entity.CompetitorProduct;
import com.sjzm.product.entity.DengZongShop;
import com.sjzm.product.entity.DengZongShopSeller;
import com.sjzm.product.entity.SkipAsin;
import com.sjzm.product.mapper.AsinImportResultMapper;
import com.sjzm.product.mapper.AsinImportTaskMapper;
import com.sjzm.product.mapper.CompetitorProductMapper;
import com.sjzm.product.mapper.DengZongShopSellerMapper;
import com.sjzm.product.mapper.SkipAsinMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
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

    private static final int DB_BATCH_SIZE = 2000; // 每批写入 DB 的行数
    
    private static final long SELLER_API_DELAY_MS = 500;
    private static final int STATUS_CHECK_INTERVAL = 5;

    private final AsinImportTaskMapper taskMapper;
    private final AsinImportResultMapper resultMapper;
    private final CompetitorService competitorService;
    private final CompetitorProductMapper competitorProductMapper;
    private final SkipAsinMapper skipAsinMapper;
    private final DengZongShopSellerMapper sellerMapper;
    private final DengZongShopService dengZongShopService;
    private final ApiRateLimitService rateLimitService;
    private final InitialFilterConfigService initialFilterConfig;
    private final SellerspriteConfig sellerspriteConfig;
    private final SellerspriteConfigService sellerspriteConfigService;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    /**
     * 应用启动时恢复僵尸任务（容器重启导致 RUNNING 但线程已死）
     */
    @jakarta.annotation.PostConstruct
    public void recoverStaleTasks() {
        try {
            AsinImportTask update = new AsinImportTask();
            update.setTaskStatus("ERROR");
            update.setErrorMessage("容器重启导致任务中断，请重新导入");
            int updated = taskMapper.update(update,
                    new LambdaQueryWrapper<AsinImportTask>()
                            .eq(AsinImportTask::getTaskStatus, "RUNNING"));
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

        // 2. 从输入文件提取 ASIN，分批送数据库查重（不加载全表）
        Set<String> inputAsins = extractInputAsins(rows);
        Set<String> blacklistAsins = batchQueryExistingBlacklist(inputAsins, marketplace);
        Set<String> mainTableAsins = batchQueryExistingMainTable(inputAsins, marketplace);
        log.info("查重完成: 输入 {} 个, 命中主表 {} 个, 命中黑名单 {} 个", inputAsins.size(), mainTableAsins.size(), blacklistAsins.size());

        // 3. 执行筛选
        Map<String, List<Map<String, String>>> filterResult = filterRows(rows, blacklistAsins, mainTableAsins, marketplace);

        // 3.5 将初筛不通过 ASIN 写入 skip_asins（后续上传可去重）
        saveFilteredAsinsToSkipTable(filterResult, marketplace);

        // 4. 创建任务记录
        AsinImportTask task = new AsinImportTask();
        task.setMarketplace(marketplace);
        task.setImportType("ASIN");
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
        task.setCreatedAt(java.time.LocalDateTime.now());
        task.setUpdatedAt(java.time.LocalDateTime.now());
        taskMapper.insert(task);

        // 5. 保存明细
        saveResults(task.getId(), filterResult, marketplace);

        // 6. 返回预览
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

    /**
     * 执行 API 调用（异步，立即返回）
     * 互斥锁：同一时间只允许一个任务执行，避免重复 API 调用
     */
    @Async
    public void executeApiCalls(Long taskId, String month) {
        AsinImportTask task = taskMapper.selectById(taskId);
        if (task == null) {
            log.error("任务不存在: {}", taskId);
            return;
        }

        // ---- 悲观锁：同一类型+同一市场只允许一个任务执行 ----
        Long activeCount = taskMapper.selectCount(
                new LambdaQueryWrapper<AsinImportTask>()
                        .eq(AsinImportTask::getImportType, "ASIN")
                        .eq(AsinImportTask::getMarketplace, task.getMarketplace())
                        .in(AsinImportTask::getTaskStatus, List.of("RUNNING", "PAUSED")));
        if (activeCount != null && activeCount > 0) {
            task.setTaskStatus("REJECTED");
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
            }

            task.setTaskStatus("DONE");
            task.setApiRequestsUsed(totalApiCalls);
            task.setParentAsinCount(totalParentCount);
            task.setVariantAsinCount(totalVariantCount);
            task.setUpdatedAt(java.time.LocalDateTime.now());
            taskMapper.updateById(task);
            log.info("任务 {} 执行完成。成功: {}, 失败: {}, API请求: {}, 父ASIN: {}, 变体: {}",
                    taskId, successCount, failCount, totalApiCalls, totalParentCount, totalVariantCount);

        } catch (Exception e) {
            log.error("任务 {} 执行异常: {}", taskId, e.getMessage(), e);
            task.setTaskStatus("ERROR");
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
            item.put("completedAt", t.getUpdatedAt());
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
        newTask.setCreatedAt(java.time.LocalDateTime.now());
        newTask.setUpdatedAt(java.time.LocalDateTime.now());
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
            task.setTaskStatus("CANCELLED");
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
        task.setCreatedAt(LocalDateTime.now());
        task.setUpdatedAt(LocalDateTime.now());
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
    public void sellerExecute(Long taskId, String month, String target) {
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
            task.setTaskStatus("REJECTED");
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
                    if (isDengZong) {
                        Map<String, Object> syncResult = dengZongShopService.syncBySellerName(sellerName, task.getMarketplace());
                        count = ((Number) syncResult.getOrDefault("inserted", 0)).intValue();
                    } else {
                        count = syncProductsBySeller(sellerName, task.getMarketplace(), month);
                    }
                    totalProducts += count;
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
                taskMapper.updateById(task);

                try { Thread.sleep(SELLER_API_DELAY_MS); } catch (InterruptedException ignored) {}
            }

            task.setTaskStatus("DONE");
            task.setUpdatedAt(LocalDateTime.now());
            taskMapper.updateById(task);
            log.info("卖家导入完成: taskId={}, sellers={}, products={}", taskId, totalSellers, totalProducts);
        } catch (Exception e) {
            log.error("卖家导入异常: {}", e.getMessage(), e);
            task.setTaskStatus("ERROR");
            task.setErrorMessage(e.getMessage());
            taskMapper.updateById(task);
        }
    }

    /** 
     * 调用卖家精灵 API 按店铺名获取产品并写入 competitor_products
     * 注意：@Transactional 在 private 方法上不生效（Spring AOP 限制），
     * 事务由调用方 sellerExecute 中的 competitorService.upsertAndFilter 内部保证
     */
    private int syncProductsBySeller(String sellerName, String marketplace, String month) {
        List<CompetitorProduct> batch = new ArrayList<>();
        int page = 1;

        while (true) {
            JsonNode data = callSellerspriteApi(sellerName, marketplace, page, 100);
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

        return batch.size();
    }

    private JsonNode callSellerspriteApi(String sellerName, String marketplace, int page, int size) {
        try {
            String body = objectMapper.writeValueAsString(Map.of(
                    "marketplace", marketplace,
                    "sellerName", sellerName,
                    "asins", new String[]{},
                    "variation", "N",
                    "page", page,
                    "size", size,
                    "orderDesc", true
            ));

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(sellerspriteConfig.getApiUrl() + "/product/competitor-lookup"))
                    .header("secret-key", sellerspriteConfigService.getSecretKey())
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofSeconds(120))
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            JsonNode result = objectMapper.readTree(response.body());

            if (!"OK".equals(result.path("code").asText())) {
                log.error("卖家精灵API错误: {}", result.path("message").asText());
                return null;
            }
            return result.path("data");
        } catch (Exception e) {
            log.error("调用卖家精灵API失败: {}", e.getMessage());
            throw new RuntimeException("API调用失败: " + e.getMessage(), e);
        }
    }

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
                result.setTitle(row.get("标题"));
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
