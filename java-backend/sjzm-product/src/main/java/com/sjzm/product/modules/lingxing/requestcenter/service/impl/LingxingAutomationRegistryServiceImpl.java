package com.sjzm.product.modules.lingxing.requestcenter.service.impl;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sjzm.product.modules.automation.entity.AutomationJobConfig;
import com.sjzm.product.modules.automation.mapper.AutomationJobConfigMapper;
import com.sjzm.product.modules.lingxing.requestcenter.entity.LingxingAutomationRequestRegistry;
import com.sjzm.product.modules.lingxing.requestcenter.entity.LingxingRequestTask;
import com.sjzm.product.modules.lingxing.requestcenter.handler.LingxingTaskHandlerRegistry;
import com.sjzm.product.modules.lingxing.requestcenter.mapper.LingxingAutomationRequestRegistryMapper;
import com.sjzm.product.modules.lingxing.requestcenter.service.LingxingAutomationRegistryService;
import com.sjzm.product.modules.lingxing.requestcenter.service.LingxingRequestCenterService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.Locale;

/** 领星自动化请求注册与排期实现。 */
@Service
@RequiredArgsConstructor
public class LingxingAutomationRegistryServiceImpl implements LingxingAutomationRegistryService {

    private static final String DEFAULT_TIMEZONE = "Asia/Shanghai";

    private final LingxingAutomationRequestRegistryMapper registryMapper;
    private final AutomationJobConfigMapper automationJobMapper;
    private final LingxingTaskHandlerRegistry handlerRegistry;
    private final LingxingRequestCenterService requestCenterService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public List<LingxingAutomationRequestRegistry> listRegistrations(Boolean enabled) {
        return registryMapper.selectList(Wrappers.<LingxingAutomationRequestRegistry>lambdaQuery()
                .eq(enabled != null, LingxingAutomationRequestRegistry::getEnabled,
                        Boolean.TRUE.equals(enabled) ? 1 : 0)
                .orderByAsc(LingxingAutomationRequestRegistry::getSlotGroup)
                .orderByAsc(LingxingAutomationRequestRegistry::getSlotOrder)
                .orderByAsc(LingxingAutomationRequestRegistry::getRegistrationCode));
    }

    @Override
    @Transactional
    public LingxingAutomationRequestRegistry saveRegistration(
            LingxingAutomationRequestRegistry input) {
        normalizeAndValidate(input);
        LingxingAutomationRequestRegistry existing = registryMapper.selectOne(
                Wrappers.<LingxingAutomationRequestRegistry>lambdaQuery()
                        .eq(LingxingAutomationRequestRegistry::getRegistrationCode,
                                input.getRegistrationCode())
                        .last("LIMIT 1"));
        if (existing != null) {
            input.setId(existing.getId());
            input.setLastEnqueuedAt(existing.getLastEnqueuedAt());
            input.setLastTaskId(existing.getLastTaskId());
            input.setLastStatus(existing.getLastStatus());
            input.setLastError(existing.getLastError());
            input.setDeleted(existing.getDeleted());
        }
        input.setNextRunAt(Integer.valueOf(1).equals(input.getEnabled())
                ? nextRun(input, LocalDateTime.now()) : null);
        if (input.getId() == null) {
            registryMapper.insert(input);
        } else {
            registryMapper.updateById(input);
            if (input.getNextRunAt() == null) {
                registryMapper.clearNextRun(input.getId());
            }
        }
        return registryMapper.selectById(input.getId());
    }

    @Override
    @Transactional
    public LingxingAutomationRequestRegistry setEnabled(String registrationCode, boolean enabled) {
        LingxingAutomationRequestRegistry row = requireForUpdate(registrationCode);
        row.setEnabled(enabled ? 1 : 0);
        row.setNextRunAt(enabled ? nextRun(row, LocalDateTime.now()) : null);
        row.setLastStatus(enabled ? "SCHEDULED" : "DISABLED");
        row.setLastError(null);
        registryMapper.updateById(row);
        if (!enabled) {
            registryMapper.clearNextRun(row.getId());
        }
        registryMapper.updateLastExecutionStatus(row.getId(),
                enabled ? "SCHEDULED" : "DISABLED", null);
        return registryMapper.selectById(row.getId());
    }

    @Override
    public List<LingxingAutomationRequestRegistry> listDue(LocalDateTime now, int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 100));
        return registryMapper.selectList(Wrappers.<LingxingAutomationRequestRegistry>lambdaQuery()
                .eq(LingxingAutomationRequestRegistry::getEnabled, 1)
                .isNotNull(LingxingAutomationRequestRegistry::getNextRunAt)
                .le(LingxingAutomationRequestRegistry::getNextRunAt, now)
                .orderByAsc(LingxingAutomationRequestRegistry::getNextRunAt)
                .orderByDesc(LingxingAutomationRequestRegistry::getPriority)
                .last("LIMIT " + safeLimit));
    }

    @Override
    @Transactional
    public LingxingRequestTask dispatch(String registrationCode, boolean dueOnly, String operator) {
        LingxingAutomationRequestRegistry row = requireForUpdate(registrationCode);
        if (!Integer.valueOf(1).equals(row.getEnabled())) {
            throw new IllegalStateException("领星自动化注册项已停用: " + row.getRegistrationCode());
        }
        LocalDateTime now = LocalDateTime.now();
        if (dueOnly && (row.getNextRunAt() == null || row.getNextRunAt().isAfter(now))) {
            return null;
        }
        validateExecutable(row);
        LingxingRequestTask task = requestCenterService.enqueueRegistered(
                row.getId(), row.getRegistrationCode(), row.getTaskType(),
                row.getPayloadTemplateJson(), row.getPriority(), operator);
        row.setLastEnqueuedAt(now);
        row.setLastTaskId(task.getTaskId());
        row.setLastStatus("PENDING");
        row.setLastError(null);
        row.setNextRunAt(nextRun(row, now));
        registryMapper.updateById(row);
        if (row.getNextRunAt() == null) {
            registryMapper.clearNextRun(row.getId());
        }
        registryMapper.updateLastExecutionStatus(row.getId(), "PENDING", null);
        return task;
    }

    private LingxingAutomationRequestRegistry requireForUpdate(String registrationCode) {
        String code = normalizeCode(registrationCode, "registrationCode");
        LingxingAutomationRequestRegistry row = registryMapper.selectByCodeForUpdate(code);
        if (row == null) {
            throw new IllegalArgumentException("领星自动化注册项不存在: " + code);
        }
        return row;
    }

    private void normalizeAndValidate(LingxingAutomationRequestRegistry row) {
        row.setRegistrationCode(normalizeCode(row.getRegistrationCode(), "registrationCode"));
        row.setAutomationJobCode(normalizeCode(row.getAutomationJobCode(), "automationJobCode"));
        row.setTaskType(normalizeCode(row.getTaskType(), "taskType"));
        row.setTaskName(requireText(row.getTaskName(), "taskName"));
        row.setEnabled(Integer.valueOf(1).equals(row.getEnabled()) ? 1 : 0);
        row.setScheduleType(normalizeCode(row.getScheduleType(), "scheduleType"));
        row.setTimezone(StringUtils.hasText(row.getTimezone())
                ? row.getTimezone().trim() : DEFAULT_TIMEZONE);
        ZoneId.of(row.getTimezone());
        row.setPriority(row.getPriority() == null ? 0 : row.getPriority());
        row.setSlotGroup(StringUtils.hasText(row.getSlotGroup())
                ? row.getSlotGroup().trim().toUpperCase(Locale.ROOT) : "DEFAULT");
        row.setSlotOrder(row.getSlotOrder() == null ? 0 : Math.max(0, row.getSlotOrder()));
        row.setMinimumGapSeconds(row.getMinimumGapSeconds() == null
                ? 60 : Math.max(0, row.getMinimumGapSeconds()));
        row.setRetryLimit(row.getRetryLimit() == null ? 0 : Math.max(0, row.getRetryLimit()));
        if (!List.of("MANUAL", "DAILY", "WEEKLY", "FIXED_DELAY").contains(row.getScheduleType())) {
            throw new IllegalArgumentException("scheduleType 仅支持 MANUAL/DAILY/WEEKLY/FIXED_DELAY");
        }
        if (("DAILY".equals(row.getScheduleType()) || "WEEKLY".equals(row.getScheduleType()))
                && row.getRunTime() == null) {
            throw new IllegalArgumentException(row.getScheduleType() + " 必须配置 runTime");
        }
        if ("WEEKLY".equals(row.getScheduleType())
                && (row.getDayOfWeek() == null || row.getDayOfWeek() < 1 || row.getDayOfWeek() > 7)) {
            throw new IllegalArgumentException("WEEKLY 的 dayOfWeek 必须为 1-7");
        }
        if ("FIXED_DELAY".equals(row.getScheduleType())
                && (row.getFixedDelaySeconds() == null || row.getFixedDelaySeconds() <= 0)) {
            throw new IllegalArgumentException("FIXED_DELAY 必须配置正数 fixedDelaySeconds");
        }
        if (StringUtils.hasText(row.getPayloadTemplateJson())) {
            try {
                objectMapper.readTree(row.getPayloadTemplateJson());
            } catch (Exception ex) {
                throw new IllegalArgumentException("payloadTemplateJson 不是合法 JSON", ex);
            }
        }
        validateExecutable(row);
    }

    private void validateExecutable(LingxingAutomationRequestRegistry row) {
        if (handlerRegistry.handlerFor(row.getTaskType()) == null) {
            throw new IllegalArgumentException("没有注册领星任务处理器: " + row.getTaskType());
        }
        AutomationJobConfig job = automationJobMapper.selectOne(
                Wrappers.<AutomationJobConfig>lambdaQuery()
                        .eq(AutomationJobConfig::getJobCode, row.getAutomationJobCode())
                        .last("LIMIT 1"));
        if (job == null) {
            throw new IllegalArgumentException("automation_job 不存在: " + row.getAutomationJobCode());
        }
        if (Integer.valueOf(1).equals(row.getEnabled())
                && !Integer.valueOf(1).equals(job.getEnabled())) {
            throw new IllegalStateException("automation_job 已停用: " + row.getAutomationJobCode());
        }
    }

    private LocalDateTime nextRun(LingxingAutomationRequestRegistry row, LocalDateTime base) {
        if (!Integer.valueOf(1).equals(row.getEnabled()) || "MANUAL".equals(row.getScheduleType())) {
            return null;
        }
        int offsetSeconds = Math.max(0, row.getSlotOrder() == null ? 0 : row.getSlotOrder())
                * Math.max(0, row.getMinimumGapSeconds() == null ? 0 : row.getMinimumGapSeconds());
        if ("FIXED_DELAY".equals(row.getScheduleType())) {
            return base.plusSeconds(row.getFixedDelaySeconds()).plusSeconds(offsetSeconds);
        }
        ZoneId zone = ZoneId.of(row.getTimezone());
        ZonedDateTime zonedBase = base.atZone(ZoneId.systemDefault()).withZoneSameInstant(zone);
        LocalTime runTime = row.getRunTime();
        LocalDate runDate = zonedBase.toLocalDate();
        if ("WEEKLY".equals(row.getScheduleType())) {
            runDate = runDate.with(TemporalAdjusters.nextOrSame(DayOfWeek.of(row.getDayOfWeek())));
        }
        ZonedDateTime candidate = ZonedDateTime.of(runDate, runTime, zone).plusSeconds(offsetSeconds);
        if (!candidate.isAfter(zonedBase)) {
            candidate = "WEEKLY".equals(row.getScheduleType())
                    ? candidate.plusWeeks(1) : candidate.plusDays(1);
        }
        return candidate.withZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime();
    }

    private String normalizeCode(String value, String field) {
        return requireText(value, field).toUpperCase(Locale.ROOT);
    }

    private String requireText(String value, String field) {
        if (!StringUtils.hasText(value)) {
            throw new IllegalArgumentException(field + " 不能为空");
        }
        return value.trim();
    }
}
