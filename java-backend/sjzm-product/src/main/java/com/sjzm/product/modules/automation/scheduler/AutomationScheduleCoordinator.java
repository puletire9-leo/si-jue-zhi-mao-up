package com.sjzm.product.modules.automation.scheduler;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sjzm.product.modules.automation.dto.AutomationRunRequest;
import com.sjzm.product.modules.automation.entity.AutomationJobConfig;
import com.sjzm.product.modules.automation.mapper.AutomationJobConfigMapper;
import com.sjzm.product.modules.automation.service.AutomationCenterService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class AutomationScheduleCoordinator {

    private final AutomationJobConfigMapper jobConfigMapper;
    private final AutomationCenterService automationCenterService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Scheduled(fixedDelayString = "${automation.scheduler.poll-delay-ms:30000}")
    public void triggerDueJobs() {
        List<AutomationJobConfig> dueJobs = jobConfigMapper.selectList(
                Wrappers.<AutomationJobConfig>lambdaQuery()
                        .eq(AutomationJobConfig::getEnabled, 1)
                        .ne(AutomationJobConfig::getScheduleType, "MANUAL")
                        .isNotNull(AutomationJobConfig::getNextRunAt)
                        .le(AutomationJobConfig::getNextRunAt, LocalDateTime.now())
                        .orderByAsc(AutomationJobConfig::getNextRunAt)
                        .last("LIMIT 50"));
        for (AutomationJobConfig config : dueJobs) {
            try {
                AutomationRunRequest request = new AutomationRunRequest();
                request.setTriggerType("SCHEDULED");
                request.setCorrelationId("schedule:" + config.getId());
                request.setParameters(readParameters(config.getParametersJson()));
                automationCenterService.trigger(config.getJobCode(), "automation-scheduler", request);
            } catch (RuntimeException ex) {
                log.warn("Automation scheduled trigger skipped/failed: jobCode={}, reason={}",
                        config.getJobCode(), ex.getMessage());
            }
        }
    }

    private Map<String, Object> readParameters(String json) {
        if (json == null || json.isBlank()) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<>() { });
        } catch (Exception ex) {
            throw new IllegalArgumentException("Invalid automation parameters_json for job", ex);
        }
    }
}
