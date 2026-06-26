package com.sjzm.product.controller;

import com.sjzm.common.Result;
import com.sjzm.product.service.CleanLayerService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/clean-layer")
@RequiredArgsConstructor
@Tag(name = "数据清洗层", description = "competitor_products_clean 维护接口")
public class CleanLayerController {

    private final CleanLayerService cleanLayerService;

    @PostMapping("/refresh-week-batch")
    @Operation(summary = "按 (marketplace, weekTag) 增量清洗",
            description = "AsinImportService 完成一个批次后自动调；也可手动调补录")
    public Result<Map<String, Object>> refreshWeekBatch(
            @RequestParam String marketplace,
            @RequestParam String weekTag) {
        return Result.success(cleanLayerService.cleanWeekBatch(marketplace, weekTag));
    }

    @PostMapping("/refresh-by-effective-week-tag")
    @Operation(summary = "按 effective_week_tag 清洗（含老数据占位 yyyyMM-W00）",
            description = "用于补录、历史回填，可处理无 week_tag 的老数据")
    public Result<Map<String, Object>> refreshByEffectiveWeekTag(
            @RequestParam String marketplace,
            @RequestParam String effectiveWeekTag) {
        return Result.success(cleanLayerService.cleanByEffectiveWeekTag(marketplace, effectiveWeekTag));
    }
}
