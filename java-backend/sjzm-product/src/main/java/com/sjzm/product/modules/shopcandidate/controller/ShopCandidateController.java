package com.sjzm.product.modules.shopcandidate.controller;

import com.sjzm.common.PageResult;
import com.sjzm.common.Result;
import com.sjzm.product.modules.shopcandidate.entity.ShopCandidatePool;
import com.sjzm.product.modules.shopcandidate.entity.ShopFetchRun;
import com.sjzm.product.modules.shopcandidate.service.ShopCandidateService;
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
    @Operation(summary = "确认抓取单店——原子抢锁 → 创建观察池 → 创建 fetch_run → 抓全集 → 写回状态",
            description = "消耗卖家精灵使用次数，前端必须二次确认")
    public Result<Map<String, Object>> confirmFetch(@PathVariable Long id) {
        return Result.success(candidateService.confirmFetch(id));
    }

    @PostMapping("/batch-confirm-fetch")
    @Operation(summary = "批量确认抓取（阶段1同步小批验证）",
            description = "逐条抢锁+抓取；每次卖家精灵 HTTP 请求仍按 2 秒限速。该同步接口不支持暂停/停止/实况队列，大批量抓取后续走卖家精灵请求中心。")
    public Result<List<Map<String, Object>>> batchConfirmFetch(@RequestBody List<Long> ids) {
        return Result.success(candidateService.batchConfirmFetch(ids));
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
