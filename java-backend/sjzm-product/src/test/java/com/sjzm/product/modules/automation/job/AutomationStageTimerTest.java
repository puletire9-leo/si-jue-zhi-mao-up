package com.sjzm.product.modules.automation.job;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AutomationStageTimerTest {

    @Test
    void recordsSuccessfulStagesInExecutionOrder() {
        AutomationStageTimer timer = new AutomationStageTimer();

        String result = timer.time("fetch", () -> "ok");
        timer.time("publish", () -> { });

        assertEquals("ok", result);
        assertEquals(java.util.List.of("fetch", "publish"),
                timer.snapshot().keySet().stream().toList());
        assertTrue(timer.snapshot().values().stream().allMatch(value -> value >= 0));
    }

    @Test
    void preservesCompletedAndFailedStageTimingsOnFailure() {
        AutomationStageTimer timer = new AutomationStageTimer();
        timer.time("fetch", () -> "ok");

        AutomationStageException error = assertThrows(AutomationStageException.class,
                () -> timer.time("publish", () -> {
                    throw new IllegalStateException("unavailable");
                }));

        assertEquals("Automation stage failed: publish - unavailable", error.getMessage());
        assertEquals(java.util.List.of("fetch", "publish"),
                error.getStageDurationsMs().keySet().stream().toList());
    }
}
