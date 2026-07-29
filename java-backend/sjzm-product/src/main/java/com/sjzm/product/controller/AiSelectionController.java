package com.sjzm.product.controller;

import com.sjzm.common.PageResult;
import com.sjzm.common.Result;
import com.sjzm.product.dto.*;
import com.sjzm.product.entity.AiSelectionProduct;
import com.sjzm.product.service.AiSelectionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * AI 选品预留控制器。
 * 提供选品列表、AI Agent 投递、手动导入、批次管理等能力。
 * 新表 ai_selection，数据源来自 shop_products + competitor_products_clean。
 *
 * <p>当前系统不启用此 Java 能力。只有显式配置
 * {@code features.ai-selection.enabled=true} 后才注册接口。</p>
 */
@RestController
@RequestMapping("/api/v1/ai-selection-pool")
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "features.ai-selection", name = "enabled", havingValue = "true")
@Tag(name = "AI 选品", description = "AI 选品投递/导入/查询/批次管理")
public class AiSelectionController {

    private final AiSelectionService aiSelectionService;

    @PostMapping("/products")
    @Operation(summary = "AI 选品列表", description = "分页+全量筛选，与选品框架 queryPlan 对接")
    public Result<PageResult<AiSelectionProduct>> queryProducts(
            @RequestBody AiSelectionQueryRequest request) {
        return Result.success(aiSelectionService.queryPage(request));
    }

    @PostMapping("/push")
    @Operation(summary = "AI Agent 投递", description = "接收 ASINs，从 shop_products / competitor_products_clean 查到后写入 ai_selection 表，返回批次信息")
    public Result<AiSelectionPushResult> push(
            @Valid @RequestBody AiSelectionPushRequest request,
            @RequestHeader(value = "X-User-Id", defaultValue = "system") String userId) {
        return Result.success(aiSelectionService.push(request, userId));
    }

    @PostMapping("/import")
    @Operation(summary = "手动导入 ASIN", description = "与 push 逻辑一致，仅入口不同")
    public Result<AiSelectionPushResult> importAsins(
            @Valid @RequestBody AiSelectionPushRequest request,
            @RequestHeader(value = "X-User-Id", defaultValue = "system") String userId) {
        return Result.success(aiSelectionService.push(request, userId));
    }

    @PostMapping("/harvest")
    @Operation(summary = "按载体全量捞取", description = "按载体检索词，从 shop_products / competitor_products_clean 全批次双通道 INSERT SELECT 进 ai_selection")
    public Result<AiSelectionPushResult> harvest(
            @Valid @RequestBody AiSelectionHarvestRequest request,
            @RequestHeader(value = "X-User-Id", defaultValue = "system") String userId) {
        return Result.success(
                aiSelectionService.harvestByCarrier(request.getCarrierKey(), request.getMarketplaces(), userId));
    }

    @GetMapping("/batches")
    @Operation(summary = "批次列表", description = "按市场站点返回批次及其商品数（RangeFilterPanel 用）")
    public Result<List<AiSelectionBatchInfo>> getBatches(
            @RequestParam(defaultValue = "UK") String marketplace) {
        return Result.success(aiSelectionService.getBatches(marketplace));
    }

    @GetMapping("/categories")
    @Operation(summary = "大类统计", description = "筛选条件下的类目分布")
    public Result<List<Map<String, Object>>> getCategories(
            @RequestParam(defaultValue = "UK") String marketplace,
            @RequestParam(required = false) List<String> batchIds) {
        return Result.success(aiSelectionService.getCategories(marketplace, batchIds));
    }

    @DeleteMapping("/batches/{batchId}")
    @Operation(summary = "删除批次及其商品")
    public Result<Void> deleteBatch(@PathVariable String batchId) {
        aiSelectionService.deleteBatch(batchId);
        return Result.success();
    }
}
