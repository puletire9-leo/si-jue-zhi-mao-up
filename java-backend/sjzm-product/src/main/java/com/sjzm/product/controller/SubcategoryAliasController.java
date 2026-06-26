package com.sjzm.product.controller;

import com.sjzm.common.Result;
import com.sjzm.product.dto.SubcategoryAliasBatchReviewRequest;
import com.sjzm.product.service.SubcategoryAliasService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/subcategory-alias")
@RequiredArgsConstructor
@Tag(name = "小类别名", description = "③线赢家小类与 competitor 末级类目的对齐层")
public class SubcategoryAliasController {

    private final SubcategoryAliasService subcategoryAliasService;

    @PostMapping("/bootstrap")
    @Operation(summary = "导种小类别名", description = "从赢家小类和 competitor 末级类目生成 canonical 映射种子")
    public Result<Map<String, Object>> bootstrap(
            @RequestParam(required = false) String marketplace,
            @RequestParam(required = false) String month) {
        return Result.success(subcategoryAliasService.bootstrap(month, marketplace));
    }

    @GetMapping("/pending")
    @Operation(summary = "查看待确认别名", description = "返回尚未自动通过的小类别名候选，按样本量倒序")
    public Result<List<Map<String, Object>>> pending(
            @RequestParam(required = false) String sourceType,
            @RequestParam(required = false) String marketplace,
            @RequestParam(defaultValue = "50") int limit) {
        return Result.success(subcategoryAliasService.listPending(sourceType, marketplace, limit));
    }

    @GetMapping("/review-candidates")
    @Operation(summary = "查看审核建议", description = "返回 pending alias 及其候选赢家方向建议，供 UK 批量审核使用")
    public Result<List<Map<String, Object>>> reviewCandidates(
            @RequestParam(required = false) String sourceType,
            @RequestParam(required = false) String marketplace,
            @RequestParam(defaultValue = "50") int limit,
            @RequestParam(defaultValue = "3") int suggestionLimit) {
        return Result.success(subcategoryAliasService.listReviewCandidates(
                sourceType,
                marketplace,
                limit,
                suggestionLimit
        ));
    }

    @PostMapping("/approve")
    @Operation(summary = "人工确认别名", description = "手工把 rawSubcategory 绑定到 canonicalKey/canonicalName")
    public Result<Map<String, Object>> approve(
            @RequestParam(defaultValue = "COMPETITOR") String sourceType,
            @RequestParam(required = false) String marketplace,
            @RequestParam String rawSubcategory,
            @RequestParam String canonicalKey,
            @RequestParam String canonicalName,
            @RequestParam(required = false) String carrierHint,
            @RequestParam(required = false) String notes) {
        return Result.success(subcategoryAliasService.approve(
                sourceType,
                marketplace,
                rawSubcategory,
                canonicalKey,
                canonicalName,
                carrierHint,
                notes
        ));
    }

    @PostMapping("/batch-review")
    @Operation(summary = "批量审核别名", description = "批量 approve / reject UK 等站点的 pending alias")
    public Result<Map<String, Object>> batchReview(@Valid @RequestBody SubcategoryAliasBatchReviewRequest request) {
        return Result.success(subcategoryAliasService.batchReview(request));
    }
}
