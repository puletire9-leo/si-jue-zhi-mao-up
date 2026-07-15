package com.sjzm.product.modules.shopcandidate.controller;

import com.sjzm.common.PageResult;
import com.sjzm.common.Result;
import com.sjzm.product.modules.shopcandidate.entity.ShopCandidatePool;
import com.sjzm.product.modules.shopcandidate.entity.ShopFetchRun;
import com.sjzm.product.modules.shopcandidate.service.ShopCandidateService;
import com.sjzm.product.modules.requestcenter.entity.SellerspriteRequestRun;
import com.sjzm.product.modules.requestcenter.service.SellerspriteRequestCenterService;
import com.sjzm.product.modules.shoprating.dto.ShopMethodBatchOption;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 店铺候选池——方法卡命中 → 候选池 → 确认抓取 → 观察池/精品池。
 */
@RestController
@RequestMapping("/api/v1/modules/shop-candidates")
@Tag(name = "店铺候选池")
@RequiredArgsConstructor
public class ShopCandidateController {

    private final ShopCandidateService candidateService;
    private final SellerspriteRequestCenterService requestCenterService;

    // ── sync from method rank ────────────────────────────────────

    @PostMapping("/sync-from-method-rank")
    @Operation(summary = "从方法卡排名同步候选池（替代旧的直写观察池）",
            description = "跑一遍方法卡店铺排名，把命中达标的店铺写入 shop_candidate_pool（PENDING），同一店同周同方法卡去重刷新")
    public Result<Map<String, Object>> syncFromMethodRank(
            @RequestParam(defaultValue = "M01") String methodId,
            @RequestParam(required = false) String marketplace,
            @RequestParam(defaultValue = "1") int minCount,
            @RequestParam(required = false) String batchCode,
            @RequestParam(defaultValue = "1000") int limit) {
        return Result.success(candidateService.syncFromMethodRank(methodId, marketplace, minCount, batchCode, limit));
    }

    @GetMapping("/method-batches")
    @Operation(summary = "方法卡找店来源批次",
            description = "返回方法卡实际读取的数据表和周批次。M01 当前读取 competitor_products_clean.effective_week_tag。")
    public Result<List<ShopMethodBatchOption>> methodBatches(
            @RequestParam(defaultValue = "M01") String methodId,
            @RequestParam(required = false) String marketplace,
            @RequestParam(defaultValue = "30") int limit) {
        return Result.success(candidateService.listMethodBatches(methodId, marketplace, limit));
    }

    // ── list / detail ────────────────────────────────────────────

    @GetMapping
    @Operation(summary = "候选池分页查询")
    public Result<PageResult<ShopCandidatePool>> list(
            @RequestParam(required = false) String marketplace,
            @RequestParam(required = false) String batchCode,
            @RequestParam(required = false) String sourceType,
            @RequestParam(required = false) String sourceCode,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Integer minHitCount,
            @RequestParam(required = false) String sellerName,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "50") int size) {
        return Result.success(candidateService.list(marketplace, batchCode, sourceType, sourceCode,
                status, minHitCount, sellerName, page, size));
    }

    @GetMapping("/fetchable")
    @Operation(summary = "按当前筛选条件返回全部可抓候选（跨分页全选用）",
            description = "只返回 PENDING/SELECTED/FETCH_FAILED，避免批量抓取误选已抓取、抓取中、已忽略或已入精品池记录。")
    public Result<List<ShopCandidatePool>> listFetchable(
            @RequestParam(required = false) String marketplace,
            @RequestParam(required = false) String batchCode,
            @RequestParam(required = false) String sourceType,
            @RequestParam(required = false) String sourceCode,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Integer minHitCount,
            @RequestParam(required = false) String sellerName,
            @RequestParam(defaultValue = "5000") int limit) {
        return Result.success(candidateService.listFetchable(marketplace, batchCode, sourceType, sourceCode,
                status, minHitCount, sellerName, limit));
    }

    @GetMapping("/{id}")
    @Operation(summary = "单条候选详情")
    public Result<ShopCandidatePool> getById(@PathVariable Long id) {
        return Result.success(candidateService.getById(id));
    }

    // ── status ───────────────────────────────────────────────────

    @PutMapping("/{id}/status")
    @Operation(summary = "候选状态流转（PENDING/SELECTED/IGNORED/…）")
    public Result<Integer> updateStatus(@PathVariable Long id, @RequestParam String status) {
        return Result.success(candidateService.updateStatus(id, status));
    }

    // ── confirm fetch ────────────────────────────────────────────

    @PostMapping("/{id}/confirm-fetch")
    @Operation(summary = "创建候选店铺抓取任务", description = "返回请求中心 runId，不同步调用卖家精灵")
    public Result<Map<String, Object>> confirmFetch(@PathVariable Long id) {
        ShopCandidatePool candidate = candidateService.getById(id);
        SellerspriteRequestRun run = requestCenterService.createTask("CANDIDATE_BATCH", candidate.getMarketplace(),
                "CANDIDATE_CONFIRM", null, "候选店铺确认抓取",
                List.of(new SellerspriteRequestCenterService.RequestItemInput(candidate.getMarketplace(),
                        candidate.getSellerName(), candidate.getId())), "CANDIDATE_API");
        return Result.success(Map.of("runId", run.getRunId(), "status", run.getStatus()));
    }

    @PostMapping("/batch-confirm-fetch")
    @Operation(summary = "创建候选店铺批量抓取任务", description = "返回请求中心 runId，不同步调用卖家精灵")
    public Result<Map<String, Object>> batchConfirmFetch(@RequestBody List<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            throw new IllegalArgumentException("候选店铺 ID 不能为空");
        }
        List<SellerspriteRequestCenterService.RequestItemInput> items = ids.stream()
                .map(candidateService::getById)
                .map(c -> new SellerspriteRequestCenterService.RequestItemInput(c.getMarketplace(), c.getSellerName(), c.getId()))
                .toList();
        if (items.isEmpty()) {
            throw new IllegalArgumentException("候选店铺 ID 不能为空");
        }
        String marketplace = items.stream().map(SellerspriteRequestCenterService.RequestItemInput::marketplace)
                .distinct().count() == 1 ? items.get(0).marketplace() : "MIXED";
        SellerspriteRequestRun run = requestCenterService.createTask("CANDIDATE_BATCH", marketplace,
                "CANDIDATE_CONFIRM", null, "候选店铺批量确认抓取", items, "CANDIDATE_API");
        return Result.success(Map.of("runId", run.getRunId(), "status", run.getStatus(), "count", items.size()));
    }

    // ── fetch runs ───────────────────────────────────────────────

    @GetMapping("/fetch-runs")
    @Operation(summary = "抓取运行记录分页查询")
    public Result<PageResult<ShopFetchRun>> fetchRuns(
            @RequestParam(required = false) String marketplace,
            @RequestParam(required = false) String sellerName,
            @RequestParam(required = false) String triggerType,
            @RequestParam(required = false) String batchCode,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "50") int size) {
        return Result.success(candidateService.fetchRuns(marketplace, sellerName, triggerType,
                batchCode, status, page, size));
    }

    @GetMapping("/fetch-runs/{runId}")
    @Operation(summary = "抓取运行记录详情")
    public Result<ShopFetchRun> getFetchRun(@PathVariable String runId) {
        return Result.success(candidateService.getFetchRun(runId));
    }

    // ── manual ───────────────────────────────────────────────────

    @PostMapping("/manual")
    @Operation(summary = "人工加入候选池")
    public Result<ShopCandidatePool> addManual(
            @RequestParam String marketplace,
            @RequestParam String sellerName,
            @RequestParam(required = false) String reason,
            @RequestParam(required = false) String note) {
        return Result.success(candidateService.addManual(marketplace, sellerName, reason, note));
    }

    // ── delete ───────────────────────────────────────────────────

    @DeleteMapping("/{id}")
    @Operation(summary = "删除候选记录")
    public Result<Integer> delete(@PathVariable Long id) {
        return Result.success(candidateService.delete(id));
    }
}
