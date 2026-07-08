package com.sjzm.product.modules.shoppremium.controller;

import com.sjzm.common.PageResult;
import com.sjzm.common.Result;
import com.sjzm.product.modules.shoppremium.entity.ShopPremiumPool;
import com.sjzm.product.modules.shoppremium.service.ShopPremiumService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 精品店铺池——长期复用、周期复抓。
 */
@RestController
@RequestMapping("/api/v1/modules/shop-premium")
@Tag(name = "精品店铺池")
@RequiredArgsConstructor
public class ShopPremiumController {

    private final ShopPremiumService premiumService;

    @GetMapping
    @Operation(summary = "精品池分页查询")
    public Result<PageResult<ShopPremiumPool>> list(
            @RequestParam(required = false) String marketplace,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String qualityLevel,
            @RequestParam(required = false) String refreshFrequency,
            @RequestParam(required = false) String tag,
            @RequestParam(required = false) String sellerName,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "50") int size) {
        return Result.success(premiumService.list(marketplace, status, qualityLevel,
                refreshFrequency, tag, sellerName, page, size));
    }

    @GetMapping("/{id}")
    @Operation(summary = "精品店详情")
    public Result<ShopPremiumPool> getById(@PathVariable Long id) {
        return Result.success(premiumService.getById(id));
    }

    @PostMapping("/from-candidate/{candidateId}")
    @Operation(summary = "从候选池提升到精品池（候选必须已 FETCHED）",
            description = "候选状态推进到 PROMOTED，回填 premium_id。同店已 REMOVED 时恢复原行而非新建")
    public Result<ShopPremiumPool> promoteFromCandidate(
            @PathVariable Long candidateId,
            @RequestParam(required = false) String tagsJson,
            @RequestParam(defaultValue = "MID") String qualityLevel,
            @RequestParam(defaultValue = "MONTHLY") String refreshFrequency,
            @RequestParam(required = false) String note) {
        return Result.success(premiumService.promoteFromCandidate(candidateId, tagsJson,
                qualityLevel, refreshFrequency, note));
    }

    @PostMapping("/manual")
    @Operation(summary = "人工加入精品池（前置：该店必须有成功 shop_products 快照）",
            description = "forceCreateImmediately=true 可跳过快照校验（用于立即触发抓取场景）")
    public Result<ShopPremiumPool> addManual(
            @RequestParam String marketplace,
            @RequestParam String sellerName,
            @RequestParam(required = false) String reason,
            @RequestParam(required = false) String tagsJson,
            @RequestParam(defaultValue = "MID") String qualityLevel,
            @RequestParam(defaultValue = "MONTHLY") String refreshFrequency,
            @RequestParam(required = false) String note,
            @RequestParam(defaultValue = "false") boolean forceCreateImmediately) {
        return Result.success(premiumService.addManual(marketplace, sellerName, reason, tagsJson,
                qualityLevel, refreshFrequency, note, forceCreateImmediately));
    }

    @PutMapping("/{id}")
    @Operation(summary = "修改精品店（标签/质量/频率/原因/备注）")
    public Result<ShopPremiumPool> update(@PathVariable Long id,
                                         @RequestParam(required = false) String tagsJson,
                                         @RequestParam(required = false) String qualityLevel,
                                         @RequestParam(required = false) String refreshFrequency,
                                         @RequestParam(required = false) String reason,
                                         @RequestParam(required = false) String note) {
        return Result.success(premiumService.update(id, tagsJson, qualityLevel,
                refreshFrequency, reason, note));
    }

    @PutMapping("/{id}/status")
    @Operation(summary = "状态流转（ACTIVE/PAUSED/REMOVED）")
    public Result<Integer> updateStatus(@PathVariable Long id, @RequestParam String status) {
        return Result.success(premiumService.updateStatus(id, status));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "软删除（REMOVED），同店再加入时恢复")
    public Result<Integer> remove(@PathVariable Long id) {
        return Result.success(premiumService.remove(id));
    }

    @PostMapping("/refresh/dry-run")
    @Operation(summary = "复抓 dry-run 预览（不消耗使用次数）",
            description = "返回将复抓哪些店、哪些已暂停/状态不允许跳过")
    public Result<Map<String, Object>> refreshDryRun(@RequestBody List<Long> premiumIds) {
        return Result.success(premiumService.refreshDryRun(premiumIds));
    }

    @PostMapping("/refresh/create-task")
    @Operation(summary = "创建复抓任务（入请求中心，不立即抓取）",
            description = "dry-run 通过后调用。返回 runId，前端轮询请求中心 consumeNext 推进抓取")
    public Result<Map<String, Object>> createRefreshTask(@RequestBody List<Long> premiumIds,
                                                        @RequestParam(required = false) String operator) {
        return Result.success(premiumService.createRefreshTask(premiumIds, operator));
    }
}
