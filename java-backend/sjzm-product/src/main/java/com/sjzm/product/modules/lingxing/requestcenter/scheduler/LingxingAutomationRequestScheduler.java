package com.sjzm.product.modules.lingxing.requestcenter.scheduler;

import com.sjzm.product.modules.lingxing.requestcenter.entity.LingxingAutomationRequestRegistry;
import com.sjzm.product.modules.lingxing.requestcenter.service.LingxingAutomationRegistryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

/** 扫描到期注册项，并把请求交给现有领星请求队列。 */
@Slf4j
@Component
@RequiredArgsConstructor
public class LingxingAutomationRequestScheduler {

    private final LingxingAutomationRegistryService registryService;

    @Scheduled(fixedDelayString = "${lingxing.request.registry-poll-delay-ms:30000}")
    public void enqueueDueRegistrations() {
        for (LingxingAutomationRequestRegistry row
                : registryService.listDue(LocalDateTime.now(), 50)) {
            try {
                registryService.dispatch(row.getRegistrationCode(), true,
                        "lingxing-registry-scheduler");
            } catch (RuntimeException ex) {
                log.warn("领星自动化注册项到期入队失败: code={}, reason={}",
                        row.getRegistrationCode(), ex.getMessage());
            }
        }
    }
}
