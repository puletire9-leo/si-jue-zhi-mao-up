package com.sjzm.product.modules.lingxing.requestcenter.controller;

import com.sjzm.common.PageResult;
import com.sjzm.common.Result;
import com.sjzm.product.modules.lingxing.requestcenter.dto.UnifiedPeriodBackfillRequest;
import com.sjzm.product.modules.lingxing.requestcenter.entity.LingxingRequestTask;
import com.sjzm.product.modules.lingxing.requestcenter.entity.LingxingAutomationRequestRegistry;
import com.sjzm.product.modules.lingxing.requestcenter.service.LingxingAutomationRegistryService;
import com.sjzm.product.modules.lingxing.requestcenter.service.LingxingRequestCenterService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.Set;

/**
 * 领星请求中心：领星开放平台调用的统一任务入口。
 *
 * <p>只承载任务基础设施（入队/恢复/状态/详情/列表），不含任何业务逻辑；
 * 业务处理器通过 {@code LingxingTaskHandler} 挂接。</p>
 */
@RestController
@RequestMapping("/api/v1/modules/lingxing/request-center")
@RequiredArgsConstructor
@Tag(name = "领星请求中心", description = "领星开放平台调用的统一任务入口")
public class LingxingRequestCenterController {

    private final LingxingRequestCenterService centerService;
    private final LingxingAutomationRegistryService registryService;

    @GetMapping("/registrations")
    @Operation(summary = "查询领星自动化请求注册表")
    public Result<java.util.List<LingxingAutomationRequestRegistry>> registrations(
            @RequestParam(required = false) Boolean enabled) {
        return Result.success(registryService.listRegistrations(enabled));
    }

    @PutMapping("/registrations/{registrationCode}")
    @Operation(summary = "新增或更新领星自动化请求注册项")
    public Result<LingxingAutomationRequestRegistry> saveRegistration(
            @PathVariable String registrationCode,
            @RequestBody LingxingAutomationRequestRegistry request) {
        request.setRegistrationCode(registrationCode);
        return Result.success(registryService.saveRegistration(request));
    }

    @PostMapping("/registrations/{registrationCode}/enabled")
    @Operation(summary = "启用或停用领星自动化请求注册项")
    public Result<LingxingAutomationRequestRegistry> setRegistrationEnabled(
            @PathVariable String registrationCode, @RequestBody EnabledRequest request) {
        return Result.success(registryService.setEnabled(registrationCode, request.enabled()));
    }

    @PostMapping("/registrations/{registrationCode}/dispatch")
    @Operation(summary = "按注册项立即生成一次领星请求任务")
    public Result<LingxingRequestTask> dispatchRegistration(
            @PathVariable String registrationCode,
            @RequestParam(defaultValue = "manual") String operator) {
        return Result.success(registryService.dispatch(registrationCode, false, operator));
    }

    @PostMapping("/tasks")
    @Operation(summary = "入队领星任务（PENDING 后自动执行）")
    public Result<LingxingRequestTask> enqueue(@RequestBody EnqueueRequest req) {
        return Result.success(centerService.enqueue(req.taskType(), req.payloadJson(), req.operator()));
    }

    @PostMapping("/unified-period-backfill")
    @Operation(summary = "入队统一表完整回补：财务日 GBP 重拉 + 周窗口，串行执行")
    public Result<Map<String, Object>> enqueueUnifiedPeriodBackfill(
            @RequestBody(required = false) UnifiedPeriodBackfillRequest request) {
        return Result.success(centerService.enqueueUnifiedPeriodBackfill(request));
    }

    @GetMapping("/tasks/{taskId}")
    @Operation(summary = "任务详情/状态")
    public Result<LingxingRequestTask> getTask(@PathVariable String taskId) {
        return Result.success(centerService.getTask(taskId));
    }

    @GetMapping("/tasks")
    @Operation(summary = "任务分页查询")
    public Result<PageResult<LingxingRequestTask>> listTasks(
            @RequestParam(required = false) String taskType,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "50") int size) {
        return Result.success(centerService.listTasks(taskType, status, page, size));
    }

    @PostMapping("/tasks/{taskId}/start")
    @Operation(summary = "唤醒 worker 消费（入队/恢复后默认自动，此接口用于手动恢复卡住的 PENDING/RUNNING 任务）")
    public Result<Map<String, Object>> start(@PathVariable String taskId) {
        return Result.success(centerService.startAutoConsume(taskId));
    }

    @PostMapping("/tasks/{taskId}/stop")
    @Operation(summary = "停止任务（PENDING/RUNNING → STOPPED）")
    public Result<Integer> stop(@PathVariable String taskId) {
        return Result.success(centerService.stop(taskId));
    }

    @PostMapping("/recover")
    @Operation(summary = "恢复排队任务：重置遗留 RUNNING 为 PENDING 并唤醒 worker（应用就绪后自动执行）")
    public Result<Integer> recover() {
        return Result.success(centerService.recoverQueuedTasks());
    }

    @GetMapping("/handlers")
    @Operation(summary = "列出已注册的任务处理器类型")
    public Result<Set<String>> handlers() {
        return Result.success(centerService.knownHandlerTypes());
    }

    /** 入队请求体。 */
    public record EnqueueRequest(String taskType, String payloadJson, String operator) {}

    public record EnabledRequest(boolean enabled) {}
}
