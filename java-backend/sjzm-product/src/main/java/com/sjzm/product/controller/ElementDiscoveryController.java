package com.sjzm.product.controller;

import com.sjzm.common.Result;
import com.sjzm.product.service.ElementDiscoveryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/element-discovery")
@RequiredArgsConstructor
@Tag(name = "元素发现", description = "④线元素机会引擎的市场扫描预览")
public class ElementDiscoveryController {

    private final ElementDiscoveryService elementDiscoveryService;

    @GetMapping("/path2-preview")
    @Operation(summary = "路径2市场反向发现预览", description = "扫描 competitor_products 标题，解析 element/carrier 并聚合输出热门元素候选")
    public Result<Map<String, Object>> path2Preview(
            @RequestParam(defaultValue = "UK") String marketplace,
            @RequestParam(required = false) String month,
            @RequestParam(defaultValue = "500") int scanLimit,
            @RequestParam(defaultValue = "20") int topN,
            @RequestParam(defaultValue = "2") int minProducts,
            @RequestParam(defaultValue = "10") int minTotalUnits) {
        return Result.success(elementDiscoveryService.previewPath2(
                marketplace,
                month,
                scanLimit,
                topN,
                minProducts,
                minTotalUnits
        ));
    }

    @GetMapping("/carrier-match-preview")
    @Operation(summary = "Carrier match preview", description = "Audit how precisely document carriers locate nonstandard candidates")
    public Result<Map<String, Object>> carrierMatchPreview(
            @RequestParam(defaultValue = "UK") String marketplace,
            @RequestParam(required = false) String month,
            @RequestParam(defaultValue = "500") int scanLimit,
            @RequestParam(defaultValue = "20") int topN,
            @RequestParam(defaultValue = "3") int samplePerCarrier,
            @RequestParam(required = false) String carrier) {
        return Result.success(elementDiscoveryService.previewCarrierMatch(
                marketplace,
                month,
                scanLimit,
                topN,
                samplePerCarrier,
                carrier
        ));
    }

    @GetMapping("/manual-candidates")
    @Operation(summary = "Manual nonstandard candidates", description = "Output title-matched carrier candidates after coarse nonstandard filtering for manual AI review")
    public Result<Map<String, Object>> manualCandidates(
            @RequestParam(defaultValue = "UK") String marketplace,
            @RequestParam(required = false) String month,
            @RequestParam(defaultValue = "1000") int scanLimit,
            @RequestParam(defaultValue = "200") int limit,
            @RequestParam(required = false) String carrier) {
        return Result.success(elementDiscoveryService.listManualCandidates(
                marketplace,
                month,
                scanLimit,
                limit,
                carrier
        ));
    }
}
