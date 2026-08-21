package com.sjzm.product.modules.automation.service.impl;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sjzm.common.BusinessException;
import com.sjzm.product.modules.automation.dto.AutomationRunRequest;
import com.sjzm.product.modules.automation.entity.AutomationJobConfig;
import com.sjzm.product.modules.automation.entity.AutomationRun;
import com.sjzm.product.modules.automation.job.AutomationExecutionContext;
import com.sjzm.product.modules.automation.job.AutomationJob;
import com.sjzm.product.modules.automation.job.AutomationJobDescriptor;
import com.sjzm.product.modules.automation.job.AutomationJobRegistry;
import com.sjzm.product.modules.automation.job.AutomationJobResult;
import com.sjzm.product.modules.automation.job.AutomationStageException;
import com.sjzm.product.modules.automation.mapper.AutomationJobConfigMapper;
import com.sjzm.product.modules.automation.mapper.AutomationRunMapper;
import com.sjzm.product.modules.automation.service.AutomationCenterService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.redisson.api.RLock;
import org.redisson.api.RedissonClient;
import org.springframework.scheduling.support.CronExpression;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
@Slf4j
@RequiredArgsConstructor
public class AutomationCenterServiceImpl implements AutomationCenterService {

    private static final String LOCK_PREFIX = "sjzm:automation:job:";

    private final AutomationJobRegistry registry;
    private final AutomationJobConfigMapper jobConfigMapper;
    private final AutomationRunMapper runMapper;
    private final RedissonClient redissonClient;
    /** Spring Boot 4 默认使用 Jackson 3；此处显式初始化仍使用旧包名的 Jackson 2 mapper。 */
    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    @Override
    public List<Map<String, Object>> listJobs() {
        Map<String, AutomationJobConfig> configs = new LinkedHashMap<>();
        for (AutomationJobConfig config : jobConfigMapper.selectList(
                Wrappers.<AutomationJobConfig>lambdaQuery().orderByAsc(AutomationJobConfig::getJobCode))) {
            configs.put(normalizeCode(config.getJobCode()), config);
        }

        List<Map<String, Object>> result = new ArrayList<>();
        for (AutomationJobDescriptor job : registry.list()) {
            AutomationJobConfig config = configs.get(job.code());
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("code", job.code());
            row.put("name", job.name());
            row.put("description", job.description());
            row.put("configured", config != null);
            row.put("enabled", config == null || Integer.valueOf(1).equals(config.getEnabled()));
            row.put("scheduleType", config == null ? "MANUAL" : config.getScheduleType());
            row.put("cronExpression", config == null ? null : config.getCronExpression());
            row.put("fixedDelaySeconds", config == null ? null : config.getFixedDelaySeconds());
            row.put("nextRunAt", config == null ? null : config.getNextRunAt());
            row.put("lastRunAt", config == null ? null : config.getLastRunAt());
            result.add(row);
        }
        return result;
    }

    @Override
    public AutomationRun trigger(String jobCode, String requestedBy, AutomationRunRequest request) {
        String normalizedCode = normalizeCode(jobCode);
        AutomationJob job = registry.find(normalizedCode)
                .orElseThrow(() -> new BusinessException(404,
                        "Automation job not found: " + normalizedCode));
        AutomationJobConfig config = findConfig(normalizedCode);
        if (config != null && !Integer.valueOf(1).equals(config.getEnabled())) {
            throw new BusinessException(409, "Automation job is disabled: " + normalizedCode);
        }

        RLock lock = redissonClient.getLock(LOCK_PREFIX + normalizedCode);
        if (!lock.tryLock()) {
            throw new BusinessException(409, "Automation job is already running: " + normalizedCode);
        }

        try {
            AutomationRunRequest body = request == null ? new AutomationRunRequest() : request;
            String triggerType = textOrDefault(body.getTriggerType(), "MANUAL").toUpperCase(Locale.ROOT);
            String operator = textOrDefault(requestedBy, "system");
            AutomationRun run = startRun(normalizedCode, triggerType, operator, body);
            return executeJob(job, config, run, triggerType, operator, body);
        } finally {
            if (lock.isHeldByCurrentThread()) {
                lock.unlock();
            }
        }
    }

    private AutomationRun executeJob(AutomationJob job, AutomationJobConfig config,
                                     AutomationRun run, String triggerType, String operator,
                                     AutomationRunRequest body) {
        long startedAt = System.nanoTime();
        try {
            AutomationJobResult result = job.execute(new AutomationExecutionContext(
                    run.getId(), run.getRunNo(), triggerType, operator,
                    textOrDefault(body.getCorrelationId(), ""), body.getParameters()));
            AutomationJobResult actual = result == null ? AutomationJobResult.empty() : result;
            finishSuccess(run, actual, elapsedMs(startedAt));
            updateScheduleAfterRun(config);
            return run;
        } catch (RuntimeException ex) {
            finishFailure(run, ex, elapsedMs(startedAt));
            updateScheduleAfterRun(config);
            throw new BusinessException("Automation job failed: " + run.getJobCode() + " - "
                    + truncate(ex.getMessage(), 500), ex);
        }
    }

    @Override
    public List<AutomationRun> listRuns(String jobCode, int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 200));
        return runMapper.selectList(Wrappers.<AutomationRun>lambdaQuery()
                .eq(jobCode != null && !jobCode.isBlank(), AutomationRun::getJobCode,
                        jobCode == null ? null : normalizeCode(jobCode))
                .orderByDesc(AutomationRun::getStartedAt)
                .last("LIMIT " + safeLimit));
    }

    @Override
    public int interruptStaleLingxingRequestRuns() {
        int interrupted = runMapper.interruptStaleLingxingRequestRuns();
        if (interrupted > 0) {
            log.warn("自动化中心启动恢复：收口领星关联遗留 RUNNING 审计 {} 条", interrupted);
        }
        return interrupted;
    }

    private AutomationRun startRun(String jobCode, String triggerType,
                                   String requestedBy, AutomationRunRequest request) {
        AutomationRun run = new AutomationRun();
        run.setRunNo(UUID.randomUUID().toString().replace("-", ""));
        run.setJobCode(jobCode);
        run.setTriggerType(triggerType);
        run.setRequestedBy(requestedBy);
        run.setCorrelationId(textOrDefault(request.getCorrelationId(), null));
        run.setStatus("RUNNING");
        run.setRequestJson(json(request.getParameters()));
        run.setTotalCount(0L);
        run.setSuccessCount(0L);
        run.setFailedCount(0L);
        run.setSkippedCount(0L);
        run.setStartedAt(LocalDateTime.now());
        runMapper.insert(run);
        return run;
    }

    private void finishSuccess(AutomationRun run, AutomationJobResult result, long totalDurationMs) {
        run.setStatus(result.failedCount() > 0 ? "PARTIAL_SUCCESS" : "SUCCESS");
        run.setTotalCount(result.totalCount());
        run.setSuccessCount(result.successCount());
        run.setFailedCount(result.failedCount());
        run.setSkippedCount(result.skippedCount());
        Map<String, Object> details = new LinkedHashMap<>(result.details());
        details.put("totalDurationMs", totalDurationMs);
        run.setResultJson(json(details));
        run.setFinishedAt(LocalDateTime.now());
        runMapper.updateById(run);
    }

    private void finishFailure(AutomationRun run, RuntimeException ex, long totalDurationMs) {
        run.setStatus("FAILED");
        run.setErrorMessage(truncate(ex.getMessage(), 1000));
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("totalDurationMs", totalDurationMs);
        if (ex instanceof AutomationStageException stageException) {
            details.put("stageDurationsMs", stageException.getStageDurationsMs());
            details.put("failedStage", failedStage(ex.getMessage()));
        }
        run.setResultJson(json(details));
        run.setFinishedAt(LocalDateTime.now());
        runMapper.updateById(run);
    }

    private long elapsedMs(long startedAt) {
        return (System.nanoTime() - startedAt) / 1_000_000L;
    }

    private String failedStage(String message) {
        if (message == null || !message.startsWith("Automation stage failed: ")) return "unknown";
        String value = message.substring("Automation stage failed: ".length());
        int separator = value.indexOf(" - ");
        return separator < 0 ? value : value.substring(0, separator);
    }

    private AutomationJobConfig findConfig(String jobCode) {
        return jobConfigMapper.selectOne(Wrappers.<AutomationJobConfig>lambdaQuery()
                .eq(AutomationJobConfig::getJobCode, jobCode)
                .last("LIMIT 1"));
    }

    private void updateScheduleAfterRun(AutomationJobConfig config) {
        if (config == null) {
            return;
        }
        try {
            LocalDateTime now = LocalDateTime.now();
            config.setLastRunAt(now);
            config.setNextRunAt(nextRun(config, now));
            jobConfigMapper.updateById(config);
        } catch (RuntimeException ex) {
            log.error("Automation schedule update failed after run: jobCode={}, reason={}",
                    config.getJobCode(), ex.getMessage(), ex);
        }
    }

    private LocalDateTime nextRun(AutomationJobConfig config, LocalDateTime base) {
        if (!Integer.valueOf(1).equals(config.getEnabled())) {
            return null;
        }
        String scheduleType = textOrDefault(config.getScheduleType(), "MANUAL")
                .toUpperCase(Locale.ROOT);
        if ("FIXED_DELAY".equals(scheduleType) && config.getFixedDelaySeconds() != null
                && config.getFixedDelaySeconds() > 0) {
            return base.plusSeconds(config.getFixedDelaySeconds());
        }
        if ("CRON".equals(scheduleType) && config.getCronExpression() != null
                && !config.getCronExpression().isBlank()) {
            ZonedDateTime next = CronExpression.parse(config.getCronExpression())
                    .next(base.atZone(ZoneId.systemDefault()));
            return next == null ? null : next.toLocalDateTime();
        }
        return null;
    }

    private String json(Object value) {
        try {
            return value == null ? "{}" : objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            throw new BusinessException("Automation payload serialization failed", ex);
        }
    }

    private String normalizeCode(String code) {
        if (code == null || code.isBlank()) {
            throw new BusinessException(400, "Automation job code must not be blank");
        }
        return code.trim().toUpperCase(Locale.ROOT);
    }

    private String textOrDefault(String value, String defaultValue) {
        return value == null || value.isBlank() ? defaultValue : value.trim();
    }

    private String truncate(String value, int maxLength) {
        if (value == null) {
            return "unknown error";
        }
        return value.length() <= maxLength ? value : value.substring(0, maxLength);
    }
}
