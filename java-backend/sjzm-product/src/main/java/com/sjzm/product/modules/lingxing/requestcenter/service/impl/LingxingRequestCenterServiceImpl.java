package com.sjzm.product.modules.lingxing.requestcenter.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sjzm.common.PageResult;
import com.sjzm.product.modules.automation.job.FinanceDailyReportJob;
import com.sjzm.product.modules.automation.service.AutomationCenterService;
import com.sjzm.product.modules.lingxing.requestcenter.dto.UnifiedPeriodBackfillRequest;
import com.sjzm.product.modules.lingxing.requestcenter.entity.LingxingRequestTask;
import com.sjzm.product.modules.lingxing.requestcenter.handler.LingxingTaskExecutionContext;
import com.sjzm.product.modules.lingxing.requestcenter.handler.LingxingTaskHandler;
import com.sjzm.product.modules.lingxing.requestcenter.handler.LingxingTaskHandlerRegistry;
import com.sjzm.product.modules.lingxing.requestcenter.handler.LingxingTaskResult;
import com.sjzm.product.modules.lingxing.requestcenter.mapper.LingxingRequestTaskMapper;
import com.sjzm.product.modules.lingxing.requestcenter.mapper.LingxingAutomationRequestRegistryMapper;
import com.sjzm.product.modules.lingxing.requestcenter.service.LingxingRequestCenterService;
import com.sjzm.product.modules.lingxing.requestcenter.service.UnifiedPeriodBackfillPlanner;
import com.sjzm.product.modules.lingxing.service.LingxingClient;
import com.sjzm.product.modules.lingxing.service.LingxingConfigService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Executor;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * 领星请求中心服务实现。
 *
 * <p>单线程 worker（{@code lingxingRequestExecutor}）按 FIFO 消费 PENDING 任务，
 * 交由按 taskType 注册的 {@link LingxingTaskHandler} 执行。领星实际 HTTP 调用仍由
 * {@link LingxingClient} 的账号级串行化门禁兜底，worker 单线程 + 客户端门禁双层保证不并发。</p>
 */
@Slf4j
@Service
public class LingxingRequestCenterServiceImpl implements LingxingRequestCenterService {

    private final LingxingRequestTaskMapper taskMapper;
    private final LingxingAutomationRequestRegistryMapper registryMapper;
    private final LingxingTaskHandlerRegistry handlerRegistry;
    private final LingxingClient lingxingClient;
    private final LingxingConfigService configService;
    private final AutomationCenterService automationCenterService;
    private final ObjectMapper objectMapper = new ObjectMapper();
    @Qualifier("lingxingRequestExecutor")
    private final Executor lingxingRequestExecutor;

    /** worker 消费在途标记：单线程执行器 + 此标记保证同一时刻只有一个 drain 循环。 */
    private final AtomicBoolean draining = new AtomicBoolean(false);

    private static final int ERROR_MESSAGE_MAX_LENGTH = 500;

    public LingxingRequestCenterServiceImpl(LingxingRequestTaskMapper taskMapper,
                                            LingxingAutomationRequestRegistryMapper registryMapper,
                                            LingxingTaskHandlerRegistry handlerRegistry,
                                            LingxingClient lingxingClient,
                                            LingxingConfigService configService,
                                            AutomationCenterService automationCenterService,
                                            @Qualifier("lingxingRequestExecutor") Executor lingxingRequestExecutor) {
        this.taskMapper = taskMapper;
        this.registryMapper = registryMapper;
        this.handlerRegistry = handlerRegistry;
        this.lingxingClient = lingxingClient;
        this.configService = configService;
        this.automationCenterService = automationCenterService;
        this.lingxingRequestExecutor = lingxingRequestExecutor;
    }

    @Override
    @Transactional
    public LingxingRequestTask enqueue(String taskType, String payloadJson, String operator) {
        return enqueueRegistered(null, null, taskType, payloadJson, 0, operator);
    }

    @Override
    @Transactional
    public LingxingRequestTask enqueueRegistered(Long registryId, String registrationCode,
                                                 String taskType, String payloadJson,
                                                 Integer priority, String operator) {
        if (!StringUtils.hasText(taskType)) {
            throw new IllegalArgumentException("taskType 不能为空");
        }
        String normalizedType = taskType.trim().toUpperCase(java.util.Locale.ROOT);
        if (StringUtils.hasText(payloadJson)) {
            try {
                objectMapper.readTree(payloadJson);
            } catch (Exception e) {
                throw new IllegalArgumentException("payloadJson 不是合法 JSON: " + e.getMessage());
            }
        }
        LingxingRequestTask task = new LingxingRequestTask();
        task.setTaskId("LX_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12));
        task.setTaskType(normalizedType);
        task.setRegistryId(registryId);
        task.setRegistrationCode(registrationCode);
        task.setPriority(priority == null ? 0 : priority);
        task.setAccountKey(configService.getAppId());
        task.setStatus("PENDING");
        task.setPayloadJson(StringUtils.hasText(payloadJson) ? payloadJson : null);
        task.setAttemptCount(0);
        task.setOperator(operator);
        taskMapper.insert(task);
        log.info("领星请求中心任务已入队: taskId={}, taskType={}, operator={}", task.getTaskId(), normalizedType, operator);
        startAutoConsumeAfterCommit();
        return task;
    }

    @Override
    public Map<String, Object> enqueueUnifiedPeriodBackfill(UnifiedPeriodBackfillRequest request) {
        UnifiedPeriodBackfillRequest req = request == null ? new UnifiedPeriodBackfillRequest() : request;
        List<UnifiedPeriodBackfillPlanner.Spec> specs = UnifiedPeriodBackfillPlanner.plan(
                req.getWeeklyFrom(),
                req.getWeeklyTo(),
                req.getDailyFrom(),
                req.getDailyTo(),
                req.getPublishToFeishu(),
                req.getAllowRepull());
        if (specs.isEmpty()) {
            throw new IllegalArgumentException("没有可入队的时间窗");
        }
        String operator = StringUtils.hasText(req.getOperator()) ? req.getOperator() : "unified-period-backfill";
        List<String> taskIds = new ArrayList<>();
        int dailyCount = 0;
        int weeklyCount = 0;
        for (UnifiedPeriodBackfillPlanner.Spec spec : specs) {
            taskIds.add(enqueue(spec.taskType(), spec.payloadJson(), operator).getTaskId());
            if (FinanceDailyReportJob.CODE.equals(spec.taskType())) {
                dailyCount++;
            } else {
                weeklyCount++;
            }
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("queued", taskIds.size());
        result.put("dailyCount", dailyCount);
        result.put("weeklyCount", weeklyCount);
        result.put("taskIds", taskIds);
        return result;
    }

    @Override
    public LingxingRequestTask getTask(String taskId) {
        LingxingRequestTask task = taskMapper.selectOne(new LambdaQueryWrapper<LingxingRequestTask>()
                .eq(LingxingRequestTask::getTaskId, taskId));
        if (task == null) {
            throw new IllegalArgumentException("任务不存在: " + taskId);
        }
        return task;
    }

    @Override
    public PageResult<LingxingRequestTask> listTasks(String taskType, String status, Integer page, Integer size) {
        int p = Math.max(1, page == null ? 1 : page);
        int s = Math.max(1, Math.min(size == null ? 50 : size, 200));
        LambdaQueryWrapper<LingxingRequestTask> qw = new LambdaQueryWrapper<LingxingRequestTask>()
                .eq(StringUtils.hasText(taskType), LingxingRequestTask::getTaskType, taskType)
                .eq(StringUtils.hasText(status), LingxingRequestTask::getStatus, status)
                .orderByDesc(LingxingRequestTask::getId);
        Page<LingxingRequestTask> mpPage = new Page<>(p, s);
        Page<LingxingRequestTask> result = taskMapper.selectPage(mpPage, qw);
        return PageResult.of(result.getRecords(), result.getTotal(), (long) p, (long) s);
    }

    @Override
    public Map<String, Object> startAutoConsume(String taskId) {
        LingxingRequestTask task = taskMapper.selectOne(new LambdaQueryWrapper<LingxingRequestTask>()
                .eq(LingxingRequestTask::getTaskId, taskId));
        if (task == null) {
            throw new IllegalArgumentException("任务不存在: " + taskId);
        }
        if (!Set.of("PENDING", "RUNNING").contains(task.getStatus())) {
            return Map.of(
                    "taskId", taskId,
                    "started", false,
                    "status", task.getStatus(),
                    "message", "仅 PENDING/RUNNING 任务可被消费");
        }
        submitDrain();
        return Map.of(
                "taskId", taskId,
                "started", true,
                "status", task.getStatus(),
                "message", "worker 已唤醒");
    }

    @Override
    public int stop(String taskId) {
        int affected = taskMapper.stop(taskId);
        if (affected == 0) {
            throw new IllegalStateException("停止失败：任务 " + taskId + " 不存在或状态不允许停止");
        }
        return affected;
    }

    @Override
    public int recoverQueuedTasks() {
        automationCenterService.interruptStaleLingxingRequestRuns();
        int reset = taskMapper.resetStaleRunningToPending();
        if (reset > 0) {
            log.warn("领星请求中心启动恢复：重置遗留 RUNNING 任务 {} 条", reset);
        }
        if (taskMapper.selectOldestPending() != null) {
            submitDrain();
        }
        return reset;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        recoverQueuedTasks();
    }

    // ── worker ──────────────────────────────────────────────────

    private void submitDrain() {
        lingxingRequestExecutor.execute(() -> {
            if (!draining.compareAndSet(false, true)) {
                return; // 已有 drain 循环在跑，会顺带消费新任务
            }
            try {
                drainLoop();
            } catch (Exception e) {
                log.error("领星请求中心 worker 异常: {}", e.getMessage(), e);
            } finally {
                draining.set(false);
            }
            // 收尾二次检查：循环退出与 set(false) 之间可能有新任务入队，补一次唤醒
            if (taskMapper.selectOldestPending() != null) {
                submitDrain();
            }
        });
    }

    private void drainLoop() {
        while (true) {
            LingxingRequestTask task = claimNext();
            if (task == null) {
                return;
            }
            executeTask(task);
        }
    }

    private LingxingRequestTask claimNext() {
        while (true) {
            LingxingRequestTask pending = taskMapper.selectOldestPending();
            if (pending == null) {
                return null;
            }
            // DB 原子抢占：PENDING → RUNNING。多实例部署时只有一个实例能抢占成功。
            if (taskMapper.claimRunning(pending.getId()) == 1) {
                return taskMapper.selectById(pending.getId());
            }
            // 未抢占成功（被其它实例抢占，状态已变为 RUNNING），继续找下一条 PENDING
        }
    }

    private void executeTask(LingxingRequestTask task) {
        updateRegistryStatus(task, "RUNNING", null);
        LingxingTaskHandler handler = handlerRegistry.handlerFor(task.getTaskType());
        if (handler == null) {
            markFailed(task, "无注册的处理器: " + task.getTaskType());
            return;
        }
        try {
            JsonNode payload = StringUtils.hasText(task.getPayloadJson())
                    ? objectMapper.readTree(task.getPayloadJson()) : objectMapper.createObjectNode();
            LingxingTaskExecutionContext context = new LingxingTaskExecutionContext(task.getTaskId(), payload, lingxingClient);
            LingxingTaskResult result = handler.execute(context);
            if (result == null || !result.success()) {
                markFailed(task, result == null ? "处理器返回空结果" : result.message());
                return;
            }
            String resultJson = null;
            if (result.data() != null) {
                resultJson = objectMapper.writeValueAsString(result.data());
            }
            taskMapper.markSuccess(task.getId(), resultJson);
            updateRegistryStatus(task, "SUCCESS", null);
            log.info("领星请求中心任务成功: taskId={}, taskType={}", task.getTaskId(), task.getTaskType());
        } catch (Exception e) {
            markFailed(task, e.getMessage());
        }
    }

    private void markFailed(LingxingRequestTask task, String message) {
        String safe = message == null ? "未知错误" : message;
        if (safe.length() > ERROR_MESSAGE_MAX_LENGTH) {
            safe = safe.substring(0, ERROR_MESSAGE_MAX_LENGTH);
        }
        taskMapper.markFailed(task.getId(), safe);
        updateRegistryStatus(task, "FAILED", safe);
        log.warn("领星请求中心任务失败: taskId={}, taskType={}, error={}", task.getTaskId(), task.getTaskType(), safe);
    }

    private void updateRegistryStatus(LingxingRequestTask task, String status, String error) {
        if (task.getRegistryId() == null) {
            return;
        }
        registryMapper.updateLastExecutionStatus(task.getRegistryId(), status, error);
    }

    private void startAutoConsumeAfterCommit() {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            submitDrain();
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                submitDrain();
            }
        });
    }

    @Override
    public Set<String> knownHandlerTypes() {
        return handlerRegistry.knownTypes();
    }
}
