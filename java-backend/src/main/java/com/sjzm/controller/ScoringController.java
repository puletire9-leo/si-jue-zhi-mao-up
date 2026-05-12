package com.sjzm.controller;

import com.sjzm.common.BusinessException;
import com.sjzm.common.Result;
import com.sjzm.service.ScoringService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 评分管理控制器
 */
@Tag(name = "评分管理", description = "评分配置、计算、统计")
@RestController
@RequestMapping("/api/v1/scoring")
@RequiredArgsConstructor
public class ScoringController {

    private final ScoringService scoringService;

    @Operation(summary = "获取评分配置", description = "获取当前评分配置信息")
    @GetMapping("/config")
    public Result<Map<String, Object>> getScoringConfig() {
        try {
            Map<String, Object> config = scoringService.getScoringConfig();
            return Result.success(config);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("获取评分配置失败: " + e.getMessage());
        }
    }

    @Operation(summary = "更新评分配置", description = "更新评分配置信息")
    @PutMapping("/config")
    public Result<Map<String, Object>> updateScoringConfig(@RequestBody Map<String, Object> config) {
        try {
            Map<String, Object> result = scoringService.updateScoringConfig(config);
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("更新评分配置失败: " + e.getMessage());
        }
    }

    @Operation(summary = "重新计算评分", description = "重新计算所有数据的评分")
    @PostMapping("/recalculate")
    public Result<Map<String, Object>> recalculateScores() {
        try {
            Map<String, Object> result = scoringService.recalculateScores();
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("重新计算评分失败: " + e.getMessage());
        }
    }

    @Operation(summary = "评分本周数据", description = "对本周数据进行评分")
    @PostMapping("/score-current-week")
    public Result<Map<String, Object>> scoreCurrentWeek() {
        try {
            Map<String, Object> result = scoringService.scoreCurrentWeek();
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("评分本周数据失败: " + e.getMessage());
        }
    }

    @Operation(summary = "获取等级统计", description = "获取评分等级统计数据")
    @GetMapping("/grade-stats")
    public Result<List<Map<String, Object>>> getGradeStats() {
        try {
            List<Map<String, Object>> stats = scoringService.getGradeStats();
            return Result.success(stats);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("获取等级统计失败: " + e.getMessage());
        }
    }
}
