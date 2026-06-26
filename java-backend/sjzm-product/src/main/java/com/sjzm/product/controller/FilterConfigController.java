package com.sjzm.product.controller;

import com.sjzm.common.Result;
import com.sjzm.product.service.CompetitorFilterService;
import com.sjzm.product.service.FilterConfigService;
import com.sjzm.product.service.InitialFilterConfigService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/filter-config")
@RequiredArgsConstructor
@Tag(name = "筛选配置", description = "初筛/精筛阈值查看、修改、重新筛选（按国家独立配置）")
public class FilterConfigController {

    private final FilterConfigService filterConfigService;
    private final InitialFilterConfigService initialFilterConfigService;
    private final CompetitorFilterService competitorFilterService;

    @GetMapping
    @Operation(summary = "获取精筛配置")
    public Result<Map<String, Object>> getConfig(@RequestParam(defaultValue = "UK") String marketplace) {
        return Result.success(filterConfigService.getConfig(marketplace));
    }

    @PutMapping
    @Operation(summary = "更新精筛配置，可选自动重新筛选")
    public Result<Map<String, Object>> updateConfig(@RequestBody Map<String, Object> body,
                                                     @RequestParam(defaultValue = "UK") String marketplace,
                                                     @RequestParam(required = false) String dataMonth,
                                                     @RequestParam(defaultValue = "true") boolean reapply) {
        filterConfigService.updateConfig(body, marketplace);
        Map<String, Object> result = filterConfigService.getConfig(marketplace);
        if (reapply) {
            if (dataMonth == null || dataMonth.isBlank()) {
                dataMonth = java.time.LocalDate.now().format(java.time.format.DateTimeFormatter.ofPattern("yyyyMM"));
            }
            var filterResult = competitorFilterService.reapplyFilter(marketplace, dataMonth);
            result.put("reapplied", true);
            result.put("filterResult", filterResult);
        }
        return Result.success(result);
    }

    @PostMapping("/reapply")
    @Operation(summary = "手动重新筛选（不改配置，仅重新跑筛选逻辑）")
    public Result<Map<String, Object>> reapply(@RequestParam(defaultValue = "UK") String marketplace,
                                                @RequestParam(required = false) String dataMonth) {
        if (dataMonth == null || dataMonth.isBlank()) {
            dataMonth = java.time.LocalDate.now().format(java.time.format.DateTimeFormatter.ofPattern("yyyyMM"));
        }
        var filterResult = competitorFilterService.reapplyFilter(marketplace, dataMonth);
        return Result.success(Map.of(
                "marketplace", marketplace,
                "dataMonth", dataMonth,
                "filterResult", filterResult
        ));
    }

    // ---- 初筛配置 ----

    @GetMapping("/initial")
    @Operation(summary = "获取初筛配置")
    public Result<Map<String, Object>> getInitialConfig(@RequestParam(defaultValue = "UK") String marketplace) {
        return Result.success(initialFilterConfigService.getConfig(marketplace));
    }

    @PutMapping("/initial")
    @Operation(summary = "更新初筛配置")
    public Result<Map<String, Object>> updateInitialConfig(@RequestBody Map<String, Object> body,
                                                            @RequestParam(defaultValue = "UK") String marketplace) {
        initialFilterConfigService.updateConfig(body, marketplace);
        return Result.success(initialFilterConfigService.getConfig(marketplace));
    }
}
