package com.sjzm.product.modules.automation.controller;

import com.sjzm.common.Result;
import com.sjzm.product.modules.automation.dto.AutomationRunRequest;
import com.sjzm.product.modules.automation.entity.AutomationRun;
import com.sjzm.product.modules.automation.service.AutomationCenterService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/modules/automation")
@RequiredArgsConstructor
@Tag(name = "Automation Center", description = "Automation job registry, scheduling and execution audit")
public class AutomationCenterController {

    private final AutomationCenterService service;

    @GetMapping("/jobs")
    @Operation(summary = "List registered automation jobs and schedule configuration")
    public Result<List<Map<String, Object>>> listJobs() {
        return Result.success(service.listJobs());
    }

    @PostMapping("/jobs/{jobCode}/run")
    @Operation(summary = "Run a registered automation job once")
    public Result<AutomationRun> run(
            @PathVariable String jobCode,
            @RequestHeader(value = "X-Username", required = false) String username,
            @RequestBody(required = false) AutomationRunRequest request) {
        return Result.success(service.trigger(jobCode, username, request));
    }

    @GetMapping("/runs")
    @Operation(summary = "List automation execution records")
    public Result<List<AutomationRun>> runs(
            @RequestParam(required = false) String jobCode,
            @RequestParam(defaultValue = "50") int limit) {
        return Result.success(service.listRuns(jobCode, limit));
    }
}
