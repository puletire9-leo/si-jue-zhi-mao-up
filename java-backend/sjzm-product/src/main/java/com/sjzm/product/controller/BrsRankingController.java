package com.sjzm.product.controller;

import com.sjzm.common.PageResult;
import com.sjzm.common.Result;
import com.sjzm.product.dto.CompetitorLookupRequest;
import com.sjzm.product.dto.CompetitorProductResponse;
import com.sjzm.product.dto.CompetitorQueryRequest;
import com.sjzm.product.modules.requestcenter.entity.SellerspriteRequestRun;
import com.sjzm.product.modules.requestcenter.service.SellerspriteRequestCenterService;
import com.sjzm.product.service.BrsRankingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * BRS 榜单控制器。
 * 数据落 brs_ranking_raw（隔离于竞品/新品榜），查询复用统一选品筛选口径。
 * 写入：POST /lookup 交请求中心创建 BRS_ASIN_LOOKUP 任务、串行消费。
 */
@RestController
@RequestMapping("/api/v1/brs-ranking")
@RequiredArgsConstructor
@Tag(name = "BRS榜单", description = "八爪鱼 Browse Node 采集 → 卖家精灵补数 → BRS 榜单选品")
public class BrsRankingController {

    private final BrsRankingService brsRankingService;
    private final SellerspriteRequestCenterService requestCenterService;

    @PostMapping("/lookup")
    @Operation(summary = "创建 BRS 榜单 ASIN 补数任务",
            description = "异步返回请求中心 runId，串行消费写入 brs_ranking_raw，不在 HTTP 线程调用卖家精灵")
    public Result<Map<String, Object>> lookup(@Valid @RequestBody CompetitorLookupRequest request,
                                              @RequestParam(required = false) String batchLabel) {
        SellerspriteRequestRun run = requestCenterService.createBrsAsinTask(request, batchLabel, "BRS_API");
        return Result.success(Map.of("runId", run.getRunId(), "status", run.getStatus()));
    }

    @PostMapping("/products")
    @Operation(summary = "BRS 榜单选品列表（POST）", description = "分页+全量筛选，与选品框架 queryPlan 对接")
    public Result<PageResult<CompetitorProductResponse>> queryProducts(@RequestBody CompetitorQueryRequest request) {
        return Result.success(brsRankingService.queryFromDb(request));
    }

    @GetMapping("/created-weeks")
    @Operation(summary = "获取 BRS 入库批次列表（按 created_at 单天粒度）")
    public Result<List<Map<String, Object>>> createdWeeks(
            @RequestParam(defaultValue = "UK") String marketplace) {
        return Result.success(brsRankingService.getCreatedWeeks(marketplace));
    }
}
