package com.sjzm.product.modules.requestcenter.controller;

import com.sjzm.common.PageResult;
import com.sjzm.common.Result;
import com.sjzm.product.modules.requestcenter.entity.SellerspriteRequestItem;
import com.sjzm.product.modules.requestcenter.entity.SellerspriteRequestRun;
import com.sjzm.product.modules.requestcenter.gateway.SellerspriteExecutionGate;
import com.sjzm.product.modules.requestcenter.service.SellerspriteRequestCenterService;
import com.sjzm.product.modules.requestcenter.service.SellerspriteRequestCenterService.RequestItemInput;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 卖家精灵请求中心——统一 ASIN/店铺全集/候选批量/精品复抓的实况、暂停、停止、失败重试和使用次数统计。
 */
@RestController
@RequestMapping("/api/v1/modules/request-center")
@Tag(name = "卖家精灵请求中心")
@RequiredArgsConstructor
public class SellerspriteRequestCenterController {

    private final SellerspriteRequestCenterService centerService;
    private final SellerspriteExecutionGate executionGate;

    @PostMapping("/tasks")
    @Operation(summary = "创建请求中心任务（入队后自动执行）")
    public Result<SellerspriteRequestRun> createTask(@RequestBody CreateTaskRequest req) {
        List<RequestItemInput> items = req.items() == null ? List.of()
                : req.items().stream().map(i -> new RequestItemInput(i.marketplace(), i.sellerName(), i.triggerId())).toList();
        return Result.success(centerService.createTask(
                req.requestType(), req.marketplace(), req.triggerType(),
                req.triggerRef(), req.fetchReason(), items, req.operator()));
    }

    @PostMapping("/tasks/from-streaming/{taskId}")
    @Operation(summary = "从八爪鱼流式初筛 READY 任务创建请求中心 ASIN 批量查询任务",
            description = "读取 asin_import_results 的 PASS ASIN 去重后每 40 个 ASIN 创建一个子项，" +
                    "以 ASIN_BATCH_LOOKUP 类型入队请求中心，自动启动后台消费。")
    public Result<SellerspriteRequestRun> createFromStreamingTask(
            @PathVariable Long taskId,
            @RequestParam(defaultValue = "") String operator,
            @RequestParam(defaultValue = "八爪鱼初筛 PASS 执行卖家精灵") String fetchReason) {
        return Result.success(centerService.createTaskFromStreamingResult(taskId, operator, fetchReason));
    }

    @PostMapping("/dry-run")
    @Operation(summary = "dry-run 预览（不创建任务，不消耗使用次数）")
    public Result<Map<String, Object>> dryRun(@RequestBody CreateTaskRequest req) {
        List<RequestItemInput> items = req.items() == null ? List.of()
                : req.items().stream().map(i -> new RequestItemInput(i.marketplace(), i.sellerName(), i.triggerId())).toList();
        return Result.success(centerService.dryRunPreview(req.requestType(), req.marketplace(), items, req.description()));
    }

    @PostMapping("/tasks/{runId}/consume")
    @Operation(summary = "消费一步——取一批 PENDING 子项逐条抓取（2 秒限速由抓取服务保证）",
            description = "PENDING→RUNNING，逐条抓取，单条失败不阻塞。建议前端轮询调用直到 status 终态")
    public Result<Map<String, Object>> consumeNext(@PathVariable String runId,
                                                   @RequestParam(defaultValue = "5") int batchSize) {
        return Result.success(centerService.consumeNext(runId, batchSize));
    }

    @PostMapping("/tasks/{runId}/start")
    @Operation(summary = "唤醒自动执行 worker（任务创建后默认会自动执行，此接口用于手动恢复卡住的 PENDING/RUNNING 任务）")
    public Result<Map<String, Object>> startAutoConsume(@PathVariable String runId) {
        return Result.success(centerService.startAutoConsume(runId));
    }

    @PostMapping("/tasks/{runId}/pause")
    @Operation(summary = "暂停任务（RUNNING → PAUSED）")
    public Result<Integer> pause(@PathVariable String runId) {
        return Result.success(centerService.pause(runId));
    }

    @PostMapping("/tasks/{runId}/resume")
    @Operation(summary = "恢复任务（PAUSED 或 PAUSED_SYSTEM → RUNNING）")
    public Result<Integer> resume(@PathVariable String runId) {
        return Result.success(centerService.resume(runId));
    }

    @PostMapping("/tasks/{runId}/stop")
    @Operation(summary = "停止任务（RUNNING/PAUSED/PENDING → STOPPED，worker 遇到 STOPPED 不再消费）")
    public Result<Integer> stop(@PathVariable String runId) {
        return Result.success(centerService.stop(runId));
    }

    @GetMapping("/tasks")
    @Operation(summary = "任务分页查询")
    public Result<PageResult<SellerspriteRequestRun>> listTasks(
            @RequestParam(required = false) String requestType,
            @RequestParam(required = false) String triggerType,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String batchCode,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "50") int size) {
        return Result.success(centerService.listRuns(requestType, triggerType, status, batchCode, page, size));
    }

    @GetMapping("/health")
    @Operation(summary = "卖家精灵网关健康与熔断状态")
    public Result<Map<String, Object>> health() {
        return Result.success(executionGate.health());
    }

    @GetMapping("/tasks/{runId}")
    @Operation(summary = "任务详情")
    public Result<SellerspriteRequestRun> getTask(@PathVariable String runId) {
        return Result.success(centerService.getRun(runId));
    }

    @GetMapping("/tasks/{runId}/items")
    @Operation(summary = "任务子项列表")
    public Result<List<SellerspriteRequestItem>> listItems(@PathVariable String runId) {
        return Result.success(centerService.listItems(runId));
    }

    @PostMapping("/items/{itemId}/retry")
    @Operation(summary = "重试单条 FAILED 子项（置回 PENDING，run 重开为 RUNNING）")
    public Result<Integer> retryItem(@PathVariable Long itemId) {
        return Result.success(centerService.retryItem(itemId));
    }

    /** 创建任务请求体。 */
    public record CreateTaskRequest(
            String requestType,
            String marketplace,
            String triggerType,
            String triggerRef,
            String fetchReason,
            String description,
            String operator,
            List<ItemInput> items) {}

    public record ItemInput(String marketplace, String sellerName, Long triggerId) {}
}
