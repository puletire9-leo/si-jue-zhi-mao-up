package com.sjzm.product.modules.shoprating.controller;

import com.sjzm.common.Result;
import com.sjzm.product.modules.shoprating.dto.ShopRatingResult;
import com.sjzm.product.modules.shoprating.service.ShopRatingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/modules/shop-rating")
@RequiredArgsConstructor
@Tag(name = "店铺评级", description = "店铺与郑总模式匹配度评分")
public class ShopRatingController {

    private final ShopRatingService shopRatingService;

    @GetMapping("/candidates")
    @Operation(summary = "获取候选店铺（新品榜 >10 新品）")
    public Result<List<ShopRatingResult.CandidateShop>> candidates(
            @RequestParam(defaultValue = "UK") String marketplace,
            @RequestParam(defaultValue = "10") int minCount) {
        return Result.success(shopRatingService.getCandidates(marketplace, minCount));
    }

    @PostMapping("/evaluate")
    @Operation(summary = "触发异步评级任务")
    public Result<Map<String, String>> evaluate(
            @RequestParam(defaultValue = "UK") String marketplace,
            @RequestParam(defaultValue = "10") int minCount) {
        String taskId = shopRatingService.evaluate(marketplace, minCount);
        return Result.success(Map.of("taskId", taskId));
    }

    @GetMapping("/task/{taskId}")
    @Operation(summary = "查询评级任务状态")
    public Result<ShopRatingResult.TaskStatus> taskStatus(@PathVariable String taskId) {
        return Result.success(shopRatingService.getTaskStatus(taskId));
    }
}
